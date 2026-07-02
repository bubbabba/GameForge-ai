/**
 * Phaser.js 2D game generation — chunked multi-call approach.
 *
 * Instead of one giant Claude call (which timeouts on complex games), we break
 * generation into 5 focused calls, each with its own 65-second timeout and
 * up to 3 auto-retries with exponential backoff:
 *
 *   Call 1  — Game Design Document (fast, creative, ~10s)
 *   Call 1b — Visual element extraction (sprite specs + art context)
 *   Call 2  — Core engine: BootScene + MenuScene + GameScene skeleton + player movement
 *   Call 3  — Enemy code ONLY: enemy classes/methods added to chunk 2 code
 *   Call 4  — UI/scoring ONLY + complete GameOverScene added to chunk 3 code
 *   Call 5  — Final assembly: sprint preload, config, var game, cleanup (temp 0.2)
 *
 * Design note — chunks 3/4 output ONLY their additions (not full rewrites).
 * The assembler (call 5) receives the skeleton plus the labeled additions and
 * produces the final merged file. This keeps every call well within 8k tokens.
 */

import Anthropic from "@anthropic-ai/sdk";
import { identifyVisualElements, type SpriteSpec, type GameContext } from "./generateGameSprites";

const MODEL         = "claude-sonnet-4-6";
const CHUNK_MAX_TOKENS = 8000;
const CHUNK_TIMEOUT_MS = 65_000; // 65 s per chunk (60 s + small buffer)
const TEMP_CREATIVE = 0.9;
const TEMP_ASSEMBLY = 0.2;
const MAX_RETRIES   = 3;

// ─── HTML wrapper ─────────────────────────────────────────────────────────────

const WRAPPER_HEAD =
  `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Game</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#111;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}</style>
<script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"><` +
  `/script>
</head>
<body>
<script>
`;

const WRAPPER_FOOT = `
<` + `/script>
</body>
</html>`;

// ─── Live sprite-swap listener ────────────────────────────────────────────────

const SPRITE_SWAP_LISTENER = `
// Live sprite injection — swaps colored placeholder shapes with real pixel art
window.addEventListener('message',function(e){if(!e.data||e.data.type!=='spriteReady')return;try{var n=e.data.name,u=e.data.url;game.scene.scenes.forEach(function(s){if(!s.sys.isActive()&&!s.sys.isSleeping())return;try{if(s.textures.exists(n))s.textures.remove(n);s.load.image(n,u);s.load.once('complete',function(){s.children.list.forEach(function(o){try{if(o&&o.texture&&o.texture.key===n)o.setTexture(n);}catch(_){}});try{if(s.physics&&s.physics.world)s.physics.world.bodies.entries.forEach(function(b){try{if(b.gameObject&&b.gameObject.texture&&b.gameObject.texture.key===n)b.gameObject.setTexture(n);}catch(_){}});}catch(_){}});s.load.start();}catch(_){}});}catch(_){}});`;

// ─── SVG placeholder textures ─────────────────────────────────────────────────

const PLACEHOLDER_COLORS: Record<string, string> = {
  player: "rgb(74,222,128)",
  enemy:  "rgb(248,113,113)",
  enemy2: "rgb(251,146,60)",
  enemy3: "rgb(167,139,250)",
  item:   "rgb(251,191,36)",
  item2:  "rgb(56,189,248)",
};

function buildPlaceholderPreload(specs: SpriteSpec[]): string {
  const lines: string[] = [];
  lines.push(`  this.load.image('bg','data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="rgb(26,26,46)"/></svg>');`);
  for (const spec of specs) {
    const color = PLACEHOLDER_COLORS[spec.name] ?? "rgb(150,150,150)";
    const size  = spec.type === "item" ? 28 : 48;
    lines.push(`  this.load.image('${spec.name}','data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${color}"/></svg>');`);
  }
  return lines.join("\n");
}

function buildEntityUsage(specs: SpriteSpec[]): string {
  return specs.map((spec) => {
    const size = spec.type === "item" ? 28 : 48;
    switch (spec.type) {
      case "player":
        return `- Player ('player'): this.player = this.physics.add.image(x,y,'player').setDisplaySize(${size},${size})`;
      case "enemy":
        return `- Enemy ('${spec.name}'): enemies.create(x,y,'${spec.name}').setDisplaySize(${size},${size})`;
      case "item":
        return `- Item ('${spec.name}'): items.create(x,y,'${spec.name}').setDisplaySize(${size},${size})`;
      default:
        return `- ('${spec.name}'): this.physics.add.image(x,y,'${spec.name}').setDisplaySize(${size},${size})`;
    }
  }).join("\n");
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function stripFences(text: string): string {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s
      .replace(new RegExp("^```(?:javascript|js|typescript|ts)?\\r?\\n"), "")
      .replace(new RegExp("\\r?\\n```\\s*$"), "")
      .trim();
  }
  return s;
}

/** Detect if Claude's output was cut off mid-generation at the token limit. */
function detectTruncation(code: string): boolean {
  const trimmed = code.trimEnd();
  if (!trimmed) return true;
  const lastLine = trimmed.split("\n").filter((l) => l.trim()).pop() ?? "";
  // Last line must be an explicit closing brace, semicolon, or the game assignment
  // Whitespace-only or identifier chars → truncated
  if (!/^[}\s]*;?\s*$|var game = new Phaser\.Game/.test(lastLine)) return true;
  // Balanced braces — more than 2 unclosed almost certainly means truncated
  const opens  = (code.match(/\{/g) ?? []).length;
  const closes = (code.match(/\}/g) ?? []).length;
  if (opens - closes > 2) return true;
  return false;
}

/** Verify all required labeled blocks are present and properly closed. */
function validateChunk3(code: string): string | null {
  const required = [
    "===ENEMIES_CREATE===",    "===ENEMIES_CREATE_END===",
    "===ENEMIES_UPDATE===",    "===ENEMIES_UPDATE_END===",
  ];
  for (const label of required) {
    if (!code.includes(label)) return `Missing required label: ${label}`;
  }
  return null;
}

function validateChunk4(code: string): string | null {
  const required = [
    "===UI_CREATE===",         "===UI_CREATE_END===",
    "===UI_UPDATE===",         "===UI_UPDATE_END===",
    "===GAMEOVER_SCENE===",    "===GAMEOVER_SCENE_END===",
  ];
  for (const label of required) {
    if (!code.includes(label)) return `Missing required label: ${label}`;
  }
  if (!code.includes("GameOverScene")) return "Missing GameOverScene class";
  return null;
}

/** After assembly, confirm all labeled blocks were consumed and key structures remain. */
function validateAssembly(code: string): string | null {
  // None of the chunk labels should remain — assembler must have replaced them all
  const staleLabels = [
    "===ENEMIES_CREATE===", "===UI_CREATE===", "===GAMEOVER_SCENE===",
    "===ENEMIES===", "===UI===",
  ];
  for (const label of staleLabels) {
    if (code.includes(label)) return `Assembler left unconsumed label: ${label}`;
  }
  return null;
}

function getValidationFailure(code: string): string | null {
  if (!code.includes("Phaser.Scene"))          return "Missing Phaser.Scene class";
  if (!/update\s*\(/.test(code))               return "Missing update() function";
  if (!/create\s*\(/.test(code))               return "Missing create() function";
  if (!/keyboard|createCursorKeys|addKeys/.test(code)) return "Missing input handling";
  const nonEmpty = code.split("\n").filter((l) => l.trim()).length;
  if (nonEmpty < 80)                            return `Too short: ${nonEmpty} lines (need 80+)`;
  if (/\bplaceholder\b/i.test(code))            return "Contains placeholder text";
  if (/\bundefined\b/.test(code))               return "Contains literal 'undefined'";
  if (detectTruncation(code))                   return "Output appears truncated";
  return null;
}

function computeQualityScore(logic: string, totalRetries: number): number {
  let score = 100;
  if (totalRetries > 0) score -= Math.min(totalRetries * 6, 30);
  const nonEmpty = logic.split("\n").filter((l) => l.trim()).length;
  if (nonEmpty < 80)       score -= 25;
  else if (nonEmpty < 150) score -= 10;
  else if (nonEmpty >= 250) score += 5;
  if (!logic.includes("GameScene")) score -= 10;
  if (!/score/i.test(logic))        score -= 5;
  if (getValidationFailure(logic))   score -= 15;
  return Math.max(0, Math.min(100, score));
}

// ─── Retry helper with proper backoff ─────────────────────────────────────────

/**
 * Runs `fn(attempt)` up to MAX_RETRIES times.
 * Uses exponential back-off with jitter; doubles wait for 429/overload errors.
 * Mutates `retriesRef.count` so the caller can track total retries across all chunks.
 */
async function withChunkRetry<T>(
  fn: (attempt: number) => Promise<T>,
  label: string,
  retriesRef: { count: number },
  onStatus?: (msg: string) => void,
  logger?: any,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn(attempt);
    } catch (err: any) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        retriesRef.count++;
        logger?.warn({ err, attempt, label }, `${label} attempt ${attempt} failed — retrying`);
        onStatus?.(`⚠️ Retrying ${label} (${attempt + 1}/${MAX_RETRIES})…`);
        // Rate-limit and overload errors get longer back-off
        const isOverload = err?.status === 429 || err?.status === 529 || err?.message?.includes("overloaded");
        const base = isOverload ? 4000 : 1000;
        const jitter = Math.random() * 500;
        await new Promise((r) => setTimeout(r, base * attempt + jitter));
      }
    }
  }
  throw new Error(`${label} failed after ${MAX_RETRIES} attempts: ${(lastErr as Error)?.message ?? lastErr}`);
}

// ─── Call 1: Game Design Document ─────────────────────────────────────────────

const PLANNER_SYSTEM = `You are a senior game designer. Write a compact game design document.

Cover these points in under 250 words:
- Core mechanic (what the player does every second)
- Win and lose conditions
- 3 unique mechanics that make it fun
- Controls
- Visual style, setting, and character descriptions (be specific)
- Difficulty curve

Be specific and creative. Do not ask questions.`;

// ─── Call 2: Core Engine + Player (skeleton only) ────────────────────────────

const CHUNK2_SYSTEM = `You are an expert Phaser.js developer writing concise, working game code.

CRITICAL RULES:
- Output ONLY raw JavaScript — no HTML, no markdown, no explanations
- Write CONCISE code. Avoid verbose comments. Every line should do something.
- NEVER use HTML/DOM APIs (no document.querySelector, no HTML buttons/divs)
- MenuScene MUST have BOTH input listeners:
    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameScene'))
    this.input.on('pointerdown', () => this.scene.start('GameScene'))
- MenuScene start text MUST say: "CLICK ANYWHERE OR PRESS SPACE TO START"
- Do NOT add var config or var game yet — those come in the final step
- Leave exact comment placeholders for the next chunks:
    // ===ENEMIES=== (in GameScene.create and GameScene.update)
    // ===UI=== (in GameScene.create and GameScene.update)`;

function buildChunk2Message(gdd: string, useSprites: boolean, preloadLines: string, entityUsage: string): string {
  const preload = useSprites
    ? `EXACT lines for BootScene.preload() — copy these verbatim:\n${preloadLines}\n\nSprite keys for entities:\n${entityUsage}`
    : "Use this.add.graphics() and this.add.rectangle() for all visuals.";

  return `GDD:\n${gdd}\n\n${preload}\n\n` +
    `Write 4 scene classes (no config, no var game):
1. BootScene — preload assets (exact lines above), show "Loading…", go to MenuScene
2. MenuScene — title + "CLICK ANYWHERE OR PRESS SPACE TO START", BOTH input listeners
3. GameScene — player setup + smooth movement + // ===ENEMIES=== + // ===UI=== placeholders
   ${useSprites
     ? "Background: this.add.image(400,300,'bg').setDisplaySize(800,600).setDepth(-10) as FIRST line"
     : "Background: this.add.rectangle(400,300,800,600,0x1a1a2e) as FIRST line"}
4. GameOverScene — stub: "GAME OVER" text + click/space to MenuScene

Start: class BootScene extends Phaser.Scene {`;
}

// ─── Call 3: Enemy system (additions ONLY, labeled) ──────────────────────────

const CHUNK3_SYSTEM = `You are an expert Phaser.js developer adding an enemy system to an existing game.

Output ONLY the new enemy code — do NOT rewrite the whole game.
You MUST produce ALL of these labeled blocks in EXACTLY this format:

// ===ENEMIES_CREATE===
[enemy group/spawn setup code — runs inside GameScene.create() after player setup]
// ===ENEMIES_CREATE_END===

// ===ENEMIES_UPDATE===
[enemy movement/AI + collision result handling — runs inside GameScene.update()]
// ===ENEMIES_UPDATE_END===

// ===ENEMY_CLASSES===
[optional helper classes or standalone functions — placed BEFORE scene classes; empty block is fine]
// ===ENEMY_CLASSES_END===

ALL FOUR ===*=== and ===*_END=== markers are REQUIRED even if a block is empty.
Write concise, working code. No full-game rewrites. No markdown.`;

function buildChunk3Message(gdd: string, skeleton: string, entityUsage: string): string {
  return `GDD:\n${gdd}\n\nGAME SKELETON:\n${skeleton}\n\n` +
    `Add the enemy system. Output ONLY labeled enemy code blocks (see system instructions).
${entityUsage ? `Use these sprite keys:\n${entityUsage}` : "Use Phaser graphics for enemies."}

Enemy system must include:
- Enemy group(s) with spawn logic (spawn timer, start slow, ramp up with score/time)
- Enemy AI: movement patterns matching the GDD (patrol, chase, shoot, etc.)
- Physics collisions with player (this.physics.add.overlap/collider)
- Enemy death/despawn logic
- Item/collectible spawning if the GDD calls for it`;
}

// ─── Call 4: UI + scoring (additions ONLY, labeled) ──────────────────────────

const CHUNK4_SYSTEM = `You are an expert Phaser.js developer adding UI and game-state logic to an existing game.

Output ONLY the new UI/scoring code plus a complete GameOverScene class.
You MUST produce ALL of these labeled blocks in EXACTLY this format:

// ===UI_CREATE===
[HUD text setup — scoreText, healthText, etc. — runs inside GameScene.create()]
// ===UI_CREATE_END===

// ===UI_UPDATE===
[update scoreText, check win/lose conditions — runs inside GameScene.update()]
// ===UI_UPDATE_END===

// ===GAMEOVER_SCENE===
class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOver' }); }
  create(data) { ... }  // show GAME OVER + score + localStorage highscore + BOTH input listeners
}
// ===GAMEOVER_SCENE_END===

ALL SIX ===*=== and ===*_END=== markers are REQUIRED.
GameOverScene MUST have BOTH listeners: this.input.keyboard.once('keydown-SPACE', ...) AND this.input.on('pointerdown', ...) to restart.
Write concise code. No full-game rewrites. No markdown.`;

function buildChunk4Message(gdd: string, skeleton: string, chunk3: string): string {
  return `GDD:\n${gdd}\n\nGAME SKELETON:\n${skeleton}\n\nENEMY CODE ADDITIONS:\n${chunk3}\n\n` +
    `Add UI, scoring, and win/lose. Output ONLY labeled blocks (see system instructions).

Must include:
- Score display (this.add.text) updated every frame
- Health/lives display
- Win condition check → show win text or scene
- Lose condition check → this.scene.start('GameOver', { score })
- Complete GameOverScene: "GAME OVER" + score + highscore (localStorage) + BOTH input listeners to restart`;
}

// ─── Call 5: Final Assembly ───────────────────────────────────────────────────

const ASSEMBLER_SYSTEM = `You are a precise JavaScript code assembler. Temperature 0.2 — exact, not creative. Fix bugs only.

OUTPUT: Raw JavaScript only. No markdown, no HTML, no explanations.

EXACT ASSEMBLY PROCEDURE (follow in order):
1. Extract ===ENEMIES_CREATE=== block → insert into GameScene.create() replacing // ===ENEMIES=== comment
2. Extract ===ENEMIES_UPDATE=== block → insert into GameScene.update() replacing // ===UI=== comment — wait, do enemies first then UI in order
   Actually: in GameScene.create(), replace // ===ENEMIES=== with ENEMIES_CREATE block
             in GameScene.update(), replace // ===ENEMIES=== with ENEMIES_UPDATE block
3. Extract ===UI_CREATE=== block → append to GameScene.create() replacing // ===UI=== comment
4. Extract ===UI_UPDATE=== block → append to GameScene.update() replacing // ===UI=== comment
5. Extract ===ENEMY_CLASSES=== block → place BEFORE BootScene class definition
6. Extract ===GAMEOVER_SCENE=== block → replace the stub GameOverScene class
7. Remove ALL ===*=== and ===*_END=== comment markers — none must remain in output
8. Fix any syntax errors, unclosed braces, duplicate declarations
9. Every sprite must have .setDisplaySize(w,h)
10. Background must be first line in GameScene.create() with .setDepth(-10)
11. MenuScene MUST have BOTH: this.input.keyboard.once('keydown-SPACE', ...) AND this.input.on('pointerdown', ...)

REQUIRED FINAL LINES (verbatim — nothing after):
var config = { type: Phaser.AUTO, width: 800, height: 600, physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } }, scene: [BootScene, MenuScene, GameScene, GameOverScene] };
var game = new Phaser.Game(config);`;

function buildAssemblerMessage(
  gdd: string,
  skeleton: string,
  chunk3: string,
  chunk4: string,
  useSprites: boolean,
  preloadLines: string,
): string {
  const spritePart = useSprites
    ? `SPRITE PRELOAD (replace any existing preload calls in BootScene.preload() with exactly these):\n${preloadLines}\n`
    : "";

  return `GDD:\n${gdd}\n\n${spritePart}
GAME SKELETON (chunk 2):\n${skeleton}\n\n
ENEMY CODE (chunk 3 — inject into ===ENEMIES=== placeholders):\n${chunk3}\n\n
UI CODE (chunk 4 — inject into ===UI=== placeholders; replace GameOverScene stub):\n${chunk4}\n\n
Assemble all chunks into ONE complete working game.
Start: class BootScene extends Phaser.Scene {
End: var game = new Phaser.Game(config);`;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface Generate2DResult {
  gameCode: string;
  title: string;
  qualityScore: number;
  gamePlan: string;
  needsSpriteGeneration: boolean;
  gameContext: GameContext | null;
}

export async function generate2DGame(
  apiKey: string,
  prompt: string,
  genre: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger?: any,
  onStatus?: (msg: string) => void,
): Promise<Generate2DResult> {
  const anthropic = new Anthropic({ apiKey, timeout: CHUNK_TIMEOUT_MS });
  const status = (msg: string) => onStatus?.(msg);
  const retriesRef = { count: 0 };

  // ── Call 1: GDD ─────────────────────────────────────────────────────────────
  status("📐 Designing your game…");
  logger?.info({ promptLen: prompt.length }, "Chunk 1: GDD");

  const gamePlan = await withChunkRetry(
    async () => {
      const res = await anthropic.messages.create({
        model: MODEL, max_tokens: 1024, temperature: TEMP_CREATIVE,
        system: PLANNER_SYSTEM,
        messages: [{ role: "user", content: `User wants: ${prompt}\n\nWrite the game design document.` }],
      });
      const text = res.content[0]?.type === "text" ? res.content[0].text.trim() : "";
      if (!text || text.length < 50) throw new Error("GDD too short");
      return text;
    },
    "GDD", retriesRef, status, logger,
  ).catch(() => `A ${genre} game based on: ${prompt}`);

  logger?.info({ planLen: gamePlan.length }, "Chunk 1 done");

  // ── Call 1b: Visual element extraction ──────────────────────────────────────
  let spriteSpecs: SpriteSpec[] = [];
  let gameContext: GameContext | null = null;
  const hasReplicate = !!process.env.REPLICATE_API_KEY;

  if (hasReplicate) {
    status("👁️ Planning visuals…");
    try {
      const { sprites, context } = await identifyVisualElements(apiKey, gamePlan, prompt);
      spriteSpecs = sprites;
      gameContext = context;
      logger?.info({ specCount: sprites.length }, "Visual specs extracted");
    } catch (err) {
      logger?.warn({ err }, "Spec extraction failed — building without sprites");
    }
  }

  const useSprites    = spriteSpecs.length > 0;
  const preloadLines  = useSprites ? buildPlaceholderPreload(spriteSpecs) : "";
  const entityUsage   = useSprites ? buildEntityUsage(spriteSpecs) : "";

  // ── Call 2: Core engine + player skeleton ────────────────────────────────────
  status("⚙️ Building core engine & player…");
  logger?.info("Chunk 2: skeleton + player");

  const skeleton = await withChunkRetry(
    async (attempt) => {
      const conciseHint = attempt > 1 ? "IMPORTANT: Be very concise. Less code, more correct. " : "";
      const res = await anthropic.messages.create({
        model: MODEL, max_tokens: CHUNK_MAX_TOKENS, temperature: TEMP_CREATIVE,
        system: CHUNK2_SYSTEM,
        messages: [{ role: "user", content: conciseHint + buildChunk2Message(gamePlan, useSprites, preloadLines, entityUsage) }],
      });
      const raw  = res.content[0]?.type === "text" ? res.content[0].text : "";
      const code = stripFences(raw);
      if (!code.includes("Phaser.Scene"))  throw new Error("Missing Phaser.Scene");
      if (detectTruncation(code))           throw new Error("Output was truncated — retry with shorter code");
      if (code.split("\n").filter((l) => l.trim()).length < 30)
        throw new Error("Skeleton too short");
      return code;
    },
    "Core engine", retriesRef, status, logger,
  );

  logger?.info({ lines: skeleton.split("\n").length }, "Chunk 2 done");
  status("⚙️ Core engine ready ✓");

  // ── Call 3: Enemy system (additions only) ────────────────────────────────────
  status("🎮 Adding enemies & game world…");
  logger?.info("Chunk 3: enemy additions");

  const enemyCode = await withChunkRetry(
    async (attempt) => {
      const conciseHint = attempt > 1 ? "Be very concise (max 60 lines). ALL 6 block markers are required. " : "";
      const res = await anthropic.messages.create({
        model: MODEL, max_tokens: CHUNK_MAX_TOKENS, temperature: TEMP_CREATIVE,
        system: CHUNK3_SYSTEM,
        messages: [{ role: "user", content: conciseHint + buildChunk3Message(gamePlan, skeleton, entityUsage) }],
      });
      const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
      const code = stripFences(raw);
      const labelErr = validateChunk3(code);
      if (labelErr) throw new Error(labelErr);
      return code;
    },
    "Enemy system", retriesRef, status, logger,
  );

  logger?.info({ chars: enemyCode.length }, "Chunk 3 done");
  status("🎮 Enemy system ready ✓");

  // ── Call 4: UI + scoring (additions only) ────────────────────────────────────
  status("🎨 Adding UI, scoring & polish…");
  logger?.info("Chunk 4: UI additions");

  const uiCode = await withChunkRetry(
    async (attempt) => {
      const conciseHint = attempt > 1 ? "Be very concise (max 80 lines). ALL 6 block markers are required. " : "";
      const res = await anthropic.messages.create({
        model: MODEL, max_tokens: CHUNK_MAX_TOKENS, temperature: TEMP_CREATIVE,
        system: CHUNK4_SYSTEM,
        messages: [{ role: "user", content: conciseHint + buildChunk4Message(gamePlan, skeleton, enemyCode) }],
      });
      const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
      const code = stripFences(raw);
      const labelErr = validateChunk4(code);
      if (labelErr) throw new Error(labelErr);
      return code;
    },
    "UI & scoring", retriesRef, status, logger,
  );

  logger?.info({ chars: uiCode.length }, "Chunk 4 done");
  status("🎨 UI ready ✓");

  // ── Call 5: Final assembly ───────────────────────────────────────────────────
  status("🔧 Assembling final game…");
  logger?.info("Chunk 5: assembly");

  let logic = await withChunkRetry(
    async (attempt) => {
      const conciseHint = attempt > 1 ? "Output must be concise. REMOVE all ===*=== markers. Every marker must be consumed. " : "";
      const res = await anthropic.messages.create({
        model: MODEL, max_tokens: CHUNK_MAX_TOKENS, temperature: TEMP_ASSEMBLY,
        system: ASSEMBLER_SYSTEM,
        messages: [{
          role: "user",
          content: conciseHint + buildAssemblerMessage(gamePlan, skeleton, enemyCode, uiCode, useSprites, preloadLines),
        }],
      });
      const raw  = res.content[0]?.type === "text" ? res.content[0].text : "";
      const code = stripFences(raw);
      if (detectTruncation(code))  throw new Error("Assembly truncated");
      const fail = getValidationFailure(code);
      if (fail)                    throw new Error(`Assembly validation: ${fail}`);
      if (!code.includes("var game = new Phaser.Game"))
        throw new Error("Missing var game line");
      const staleLabel = validateAssembly(code);
      if (staleLabel)              throw new Error(staleLabel);
      return code;
    },
    "Final assembly", retriesRef, status, logger,
  );

  logger?.info({ lines: logic.split("\n").length }, "Chunk 5 done");

  // ── Final hard gate ──────────────────────────────────────────────────────────
  const finalFail = getValidationFailure(logic);
  if (finalFail) {
    logger?.error({ finalFail }, "Final validation failed after all chunks");
    throw new Error(`Game generation failed validation: ${finalFail}`);
  }

  // Escape </script> that would prematurely close the HTML wrapper
  logic = logic.replace(/<\/script>/gi, "<\\/script>");

  // Inject live sprite-swap listener
  if (useSprites) logic += SPRITE_SWAP_LISTENER;

  const gameCode = WRAPPER_HEAD + logic + WRAPPER_FOOT;

  const words     = prompt.trim().split(/\s+/).slice(0, 5);
  const titleCase = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const title     = `${titleCase} (${genre})`;

  const qualityScore = computeQualityScore(logic, retriesRef.count);
  logger?.info({ title, qualityScore, retries: retriesRef.count, useSprites }, "2D game generated via chunked pipeline");
  status("✅ Game ready!");

  return { gameCode, title, qualityScore, gamePlan, needsSpriteGeneration: useSprites, gameContext };
}
