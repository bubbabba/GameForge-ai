/**
 * Phaser.js 2D game generation via Claude — two-step approach.
 *
 * Step 1: Claude writes a game design document (GDD).
 * Step 1b: Auto-generate sprites via Replicate (parallel, optional).
 * Step 2: Claude builds a complete standalone Phaser 3 game from the GDD,
 *          using sprites if available, falling back to graphics primitives.
 *
 * No template shells — Claude generates the full game logic from scratch,
 * wrapped in a minimal HTML/Phaser CDN page.
 */

import Anthropic from "@anthropic-ai/sdk";
import { generateGameSprites, type GeneratedSprite } from "./generateGameSprites";

const MODEL = "claude-sonnet-4-6";

// ─── Phaser HTML wrapper ───────────────────────────────────────────────────────

// Split the closing tags so they don't get interpreted in this source file
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

// ─── Step 1: Game Design Document ─────────────────────────────────────────────

const PLANNER_SYSTEM = `You are a senior game designer. A user wants to make a game.

Read the user description carefully. Based on what they describe, automatically decide: what genre best fits this idea, what the visual style should be, and what mechanics would make it the most fun. Do not ask the user anything — just make a creative decision and build it.

Before writing any code, write a short game design document covering:
- Core mechanic (what does the player actually do every second)
- Win condition
- Lose condition
- 3 main features that make this game unique
- Controls
- Visual style and character descriptions
- Difficulty progression

Keep it under 200 words. Be specific and creative.`;

function buildPlannerMessage(prompt: string): string {
  return `A user wants to make this game: ${prompt}\n\nRead this description carefully. Automatically decide the best genre, visual style, and mechanics that would make this the most fun game possible. Do not ask the user anything — just make creative decisions and write the game design document now.`;
}

// ─── Step 2: Build the game ────────────────────────────────────────────────────

const BUILDER_SYSTEM = `You are an expert Phaser.js game developer. You write complete, fully working browser games. You have a creative vision and strong understanding of what makes games fun. Every game you write works perfectly on the first try.

CRITICAL RULES — never violate these:
- NEVER use HTML buttons, divs, document.querySelector, or any DOM/HTML APIs inside Phaser games — they do not work inside iframes and will always break the start screen.
- The MenuScene create() MUST register BOTH of these Phaser-native input listeners and nothing else:
    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameScene'))
    this.input.on('pointerdown', () => this.scene.start('GameScene'))
- The start screen instruction text MUST say exactly: "CLICK ANYWHERE OR PRESS SPACE TO START"
- Use ONLY Phaser's built-in input system for all user interaction.`;

interface SpriteManifest {
  sprites: GeneratedSprite[];
  background: GeneratedSprite | null;
}

function buildBuilderMessage(gdd: string, spriteManifest?: SpriteManifest): string {
  const hasSprites = spriteManifest && (spriteManifest.sprites.length > 0 || spriteManifest.background);

  let spriteSection: string;
  if (hasSprites) {
    const m = spriteManifest!;

    // Build load lines only for successfully generated sprites
    const loadLines: string[] = [];
    if (m.background) loadLines.push(`  this.load.image('bg', '${m.background.url}');`);
    for (const s of m.sprites) loadLines.push(`  this.load.image('${s.name}', '${s.url}');`);

    // Background create line (only if background sprite generated)
    const bgCreate = m.background
      ? `  this.add.image(400, 300, 'bg').setDisplaySize(800, 600).setDepth(-10);`
      : `  // No background sprite — use this.add.rectangle(400,300,800,600,0x1a1a2e).setDepth(-10); for a dark bg`;

    // Build per-entity usage instructions based on what actually succeeded
    const usageLines: string[] = [];
    const spriteKeys = new Set(m.sprites.map((s) => s.name));

    if (spriteKeys.has("player")) {
      usageLines.push("- Player: this.player = this.physics.add.image(x, y, 'player').setDisplaySize(48, 48)");
    } else {
      usageLines.push("- Player: use this.add.graphics() (no player sprite was generated)");
    }
    const enemyKeys = ["enemy", "enemy2", "enemy3"].filter((k) => spriteKeys.has(k));
    if (enemyKeys.length > 0) {
      usageLines.push(`- Enemies (use these keys: ${enemyKeys.map((k) => `'${k}'`).join(", ")}): this.physics.add.image(x, y, '${enemyKeys[0]}').setDisplaySize(48, 48)`);
    } else {
      usageLines.push("- Enemies: use this.add.graphics() (no enemy sprite was generated)");
    }
    const itemKeys = ["item", "item2"].filter((k) => spriteKeys.has(k));
    if (itemKeys.length > 0) {
      usageLines.push(`- Items/collectibles (use these keys: ${itemKeys.map((k) => `'${k}'`).join(", ")}): this.physics.add.image(x, y, '${itemKeys[0]}').setDisplaySize(28, 28)`);
    }

    spriteSection = `
SPRITES — Pre-generated pixel art sprites are provided. Use ONLY the keys listed below (do NOT use a key that isn't listed — use graphics primitives for missing elements).

In BootScene preload(), load every sprite (copy these lines exactly):
${loadLines.join("\n")}

In GameScene create(), add background AS THE FIRST LINE before any physics objects:
${bgCreate}

Per-entity usage (only use sprite keys that appear in the load list above):
${usageLines.join("\n")}
- You may still use this.add.graphics() for UI elements (health bars, score backgrounds) and any entity whose sprite key is not in the load list
- setOrigin(0.5) is the default for images — no need to set it explicitly
- For groups: this.physics.add.group() then group.create(x, y, 'enemy').setDisplaySize(48, 48)
`;
  } else {
    spriteSection = `  - Use only Phaser graphics primitives (this.add.graphics), no external images\n`;
  }

  return `Build this exact game:
${gdd}

Technical requirements:
- Use Phaser 3 with this exact config: { type: Phaser.AUTO, width: 800, height: 600, physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } }, scene: [BootScene, MenuScene, GameScene, GameOverScene] }
${spriteSection}
- Player controls must feel responsive and smooth
- Include these Phaser helpers: this.add.text, this.physics.add.group
- Game must have exactly these scenes: BootScene (loading), MenuScene (start screen), GameScene (main game), GameOverScene (end screen)
- Every scene must be a proper Phaser class that extends Phaser.Scene
- Physics collisions must use this.physics.add.collider and this.physics.add.overlap
- Player input must use this.cursors = this.input.keyboard.createCursorKeys()
- Score must be tracked and displayed
- MenuScene MUST NOT use any HTML buttons or DOM elements — only Phaser's built-in input system
- MenuScene create() MUST register BOTH: this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameScene')) AND this.input.on('pointerdown', () => this.scene.start('GameScene'))
- Start screen instruction text MUST say exactly: "CLICK ANYWHERE OR PRESS SPACE TO START"
Return only raw JavaScript code starting with the word const or class, absolutely nothing else`;
}

// ─── Strip markdown fences ─────────────────────────────────────────────────────

function stripFences(text: string): string {
  let s = text.trim();
  const fence = "```";
  if (s.startsWith(fence)) {
    s = s
      .replace(new RegExp("^" + fence + "(?:javascript|js|typescript|ts)?\\r?\\n"), "")
      .replace(new RegExp("\\r?\\n" + fence + "\\s*$"), "")
      .trim();
  }
  return s;
}

// ─── Validation (6 checks per spec) ──────────────────────────────────────────

function getValidationFailure(code: string): string | null {
  if (!code.includes("Phaser.Scene")) return "Missing Phaser.Scene class";
  if (!/update\s*\(/.test(code)) return "Missing update() function";
  if (!/create\s*\(/.test(code)) return "Missing create() function";
  if (!/keyboard|createCursorKeys|addKeys/.test(code)) return "Missing input handling";
  const nonEmpty = code.split("\n").filter((l) => l.trim().length > 0).length;
  if (nonEmpty < 100) return `Too short: ${nonEmpty} lines (need 100+)`;
  if (/\bplaceholder\b/i.test(code)) return "Contains placeholder text";
  if (/\bundefined\b/.test(code)) return "Contains undefined placeholder";
  return null;
}

// ─── Quality score ─────────────────────────────────────────────────────────────

function computeQualityScore(logic: string, failure: string | null, retried: boolean): number {
  let score = 100;
  if (failure) score -= 30;
  if (retried) score -= 10;
  const nonEmpty = logic.split("\n").filter((l) => l.trim().length > 0).length;
  if (nonEmpty < 80) score -= 25;
  else if (nonEmpty < 150) score -= 10;
  else if (nonEmpty >= 250) score += 5;
  if (!logic.includes("GameScene")) score -= 10;
  if (!/score/i.test(logic)) score -= 5;
  return Math.max(0, Math.min(100, score));
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface Generate2DResult {
  gameCode: string;
  title: string;
  qualityScore: number;
  gamePlan: string;
  sprites: GeneratedSprite[];
  backgroundSprite: GeneratedSprite | null;
}

export async function generate2DGame(
  apiKey: string,
  prompt: string,
  genre: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger?: any,
  onStatus?: (msg: string) => void,
): Promise<Generate2DResult> {
  const anthropic = new Anthropic({ apiKey, timeout: 120_000 });

  const emitStatus = (msg: string) => {
    onStatus?.(msg);
  };

  // ── Step 1: Planning (with one retry on transient failure) ──────────────────
  emitStatus("Designing your game...");
  logger?.info({ promptLength: prompt.length }, "Step 1: generating game design document");

  async function planGame(): Promise<string> {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.9,
      system: PLANNER_SYSTEM,
      messages: [{ role: "user", content: buildPlannerMessage(prompt) }],
    });
    return res.content[0]?.type === "text" ? res.content[0].text.trim() : "";
  }

  let gamePlan: string;
  try {
    gamePlan = await planGame();
  } catch {
    gamePlan = await planGame(); // single retry on transient error
  }
  if (!gamePlan) gamePlan = `A ${genre} game based on: ${prompt}`;

  logger?.info({ planLength: gamePlan.length }, "Step 1 complete — design document ready");

  // ── Step 1b: Sprite generation (parallel with Step 2 setup) ────────────────
  let spriteManifest: SpriteManifest | undefined;

  if (process.env.REPLICATE_API_KEY) {
    try {
      const { sprites, backgroundSprite } = await generateGameSprites(
        apiKey,
        gamePlan,
        prompt,
        emitStatus,
      );
      spriteManifest = { sprites, background: backgroundSprite };
      logger?.info({ spriteCount: sprites.length, hasBackground: !!backgroundSprite }, "Sprites generated");
    } catch (err) {
      logger?.warn({ err }, "Sprite generation failed — falling back to graphics primitives");
      spriteManifest = undefined;
    }
  }

  // ── Step 2: Build the game ──────────────────────────────────────────────────
  emitStatus("Building game code...");

  async function buildGame(): Promise<string> {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      temperature: 0.9,
      system: BUILDER_SYSTEM,
      messages: [{ role: "user", content: buildBuilderMessage(gamePlan, spriteManifest) }],
    });
    const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
    return stripFences(raw);
  }

  let logic = await buildGame();
  let retried = false;
  logger?.info({ chars: logic.length }, "Step 2 attempt 1 complete");

  // Validate — auto-regenerate up to 2 more times on failure
  for (let attempt = 2; attempt <= 3; attempt++) {
    const failure = getValidationFailure(logic);
    if (!failure) break;
    logger?.warn({ reason: failure, attempt }, `Validation failed — regenerating (attempt ${attempt})`);
    logic = await buildGame();
    retried = true;
    logger?.info({ chars: logic.length }, `Step 2 attempt ${attempt} complete`);
  }

  // Hard final gate — throw if all attempts still fail validation
  const finalCheck = getValidationFailure(logic);
  if (finalCheck) {
    throw new Error(`Game generation failed validation after 3 attempts: ${finalCheck}`);
  }

  // Escape any </script> that would prematurely close the wrapper's script tag
  logic = logic.replace(/<\/script>/gi, "<\\/script>");

  // Wrap in minimal Phaser HTML page
  const gameCode = WRAPPER_HEAD + logic + WRAPPER_FOOT;

  // Title from prompt
  const words = prompt.trim().split(/\s+/).slice(0, 5);
  const titleCase = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const title = `${titleCase} (${genre})`;

  // Quality score based on final code
  const closeTag = "</" + "script>";
  const finalLogic = logic.replace(new RegExp("<\\/script>", "gi"), closeTag);
  const qualityScore = computeQualityScore(finalLogic, getValidationFailure(finalLogic), retried);

  logger?.info({ title, qualityScore }, "2D game generated successfully");

  return {
    gameCode,
    title,
    qualityScore,
    gamePlan,
    sprites: spriteManifest?.sprites ?? [],
    backgroundSprite: spriteManifest?.background ?? null,
  };
}
