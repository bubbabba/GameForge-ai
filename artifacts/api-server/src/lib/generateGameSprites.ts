/**
 * Auto-generate sprites for a 2D game before the code-build step.
 *
 * 1. Ask Claude to extract a GameContext (setting, characters, art style,
 *    palette, mood) from the GDD AND identify every sprite needed — one call.
 * 2. Generate background + all character sprites in parallel via Replicate,
 *    with every prompt directly tied to the GDD details.
 * 3. Run a post-generation style-consistency check and re-generate any
 *    flagged sprites once.
 * 4. Return { sprites, backgroundSprite, context } — context is stored in DB
 *    so the cover image and editor sprite-regen stay consistent.
 */

import Anthropic from "@anthropic-ai/sdk";
import { generateSpriteFromPrompt } from "./imageGeneration";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpriteSpec {
  name: string;        // "player" | "enemy" | "enemy2" | "item" etc.
  description: string; // exact description from GDD
  type: "player" | "enemy" | "item" | "other";
}

/** Structured context extracted from the GDD — used in every image prompt. */
export interface GameContext {
  setting: string;             // "dark forest dungeon with glowing mushrooms"
  playerDescription: string;   // "armored knight with glowing sword"
  enemyDescriptions: string[]; // ["zombie warrior", "giant spider"]
  artStyle: string;            // "dark gritty pixel art"
  colorPalette: string;        // "deep purples, sickly greens, blood red accents"
  mood: string;                // "dark and foreboding"
}

export interface GeneratedSprite {
  name: string;
  objectPath: string; // /objects/images/{uuid} — stored in DB, used for sidebar thumbnails
  url: string;        // absolute URL — embedded in Phaser this.load.image()
  description: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  return domain ? `https://${domain}` : "http://localhost:8080";
}

/** Validate that a parsed GameContext has all required non-empty fields. */
function isValidContext(ctx: unknown): ctx is GameContext {
  if (!ctx || typeof ctx !== "object") return false;
  const c = ctx as Record<string, unknown>;
  return (
    typeof c.setting === "string" && c.setting.length > 3 &&
    typeof c.playerDescription === "string" && c.playerDescription.length > 3 &&
    Array.isArray(c.enemyDescriptions) && c.enemyDescriptions.length > 0 &&
    typeof c.artStyle === "string" && c.artStyle.length > 3 &&
    typeof c.colorPalette === "string" && c.colorPalette.length > 3 &&
    typeof c.mood === "string" && c.mood.length > 3
  );
}

/** Build a Replicate prompt that's directly tied to the GDD context. */
function buildReplicatePrompt(spec: SpriteSpec, ctx: GameContext): string {
  switch (spec.type) {
    case "player":
      return `pixel art sprite of ${spec.description}, in a ${ctx.setting} environment, ${ctx.colorPalette} colors, ${ctx.mood} tone, transparent background, game sprite sheet, high quality pixel art, 64x64`;
    case "enemy":
      return `pixel art sprite of ${spec.description}, ${spec.description} abilities and behaviors reflected in visual design, fits in a ${ctx.setting}, ${ctx.colorPalette} colors, ${ctx.mood} atmosphere, transparent background, menacing, detailed, 64x64`;
    case "item":
      return `pixel art game item, ${spec.description}, fits the theme of ${ctx.setting}, ${ctx.colorPalette}, transparent background, glowing effect, 64x64`;
    default:
      return `pixel art ${spec.description}, ${ctx.artStyle}, ${ctx.colorPalette} colors, transparent background, game sprite, 64x64`;
  }
}

// ─── Step 1: Identify sprites AND extract GameContext from the GDD ─────────────

const IDENTIFICATION_PROMPT = (prompt: string, gdd: string) =>
  `Game prompt: ${prompt}\n\nGame design document:\n${gdd}\n\nAnalyze this design document carefully. Extract exact details — do not invent anything not in the doc. Return exactly this JSON:\n{\n  "sprites": [\n    {"name":"player","description":"exact player description from design doc, 5-10 words","type":"player"},\n    {"name":"enemy","description":"exact enemy description from design doc, 5-10 words","type":"enemy"}\n  ],\n  "background": "exact setting and environment description from the design doc",\n  "context": {\n    "setting": "exact game world setting from the doc (e.g. neon-lit cyberpunk city, haunted dark forest, underwater cave system)",\n    "playerDescription": "exact player character from the doc (e.g. armored space marine, cute robot mechanic, shadow ninja)",\n    "enemyDescriptions": ["exact enemy 1 from the doc", "exact enemy 2 from the doc if present"],\n    "artStyle": "exact art style from the doc (e.g. dark gritty pixel art, cute cartoon pixel art, retro 8-bit arcade style)",\n    "colorPalette": "exact colors from the doc (e.g. deep purples and blood reds, neon blues and greens, warm earth tones and fire orange)",\n    "mood": "overall tone from the doc (e.g. dark and foreboding, lighthearted and playful, tense and thrilling, epic and heroic)"\n  }\n}\n\nSprite rules:\n- Exactly 1 player entry (name must be "player")\n- 1-3 enemy types (names: "enemy", "enemy2", "enemy3")\n- 0-2 collectible items (names: "item", "item2")\n- Maximum 6 sprites total\n- All descriptions must come directly from the design document`;

async function callIdentificationClaude(
  anthropic: Anthropic,
  prompt: string,
  gdd: string,
): Promise<{ sprites: SpriteSpec[]; backgroundDescription: string; context: GameContext } | null> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    temperature: 0.3,
    system: "You are a game asset designer. Output ONLY valid JSON with no markdown fences, no explanation, no extra text.",
    messages: [{ role: "user", content: IDENTIFICATION_PROMPT(prompt, gdd) }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!isValidContext(parsed.context)) return null;
    return {
      sprites: Array.isArray(parsed.sprites) ? (parsed.sprites as SpriteSpec[]).slice(0, 6) : [],
      backgroundDescription: typeof parsed.background === "string" ? parsed.background : parsed.context.setting,
      context: parsed.context as GameContext,
    };
  } catch {
    return null;
  }
}

export async function identifyVisualElements(
  apiKey: string,
  gdd: string,
  prompt: string,
): Promise<{ sprites: SpriteSpec[]; backgroundDescription: string; context: GameContext }> {
  const anthropic = new Anthropic({ apiKey, timeout: 30_000 });
  const fallbackContext: GameContext = {
    setting: `${prompt} game environment`,
    playerDescription: "game hero character",
    enemyDescriptions: ["dangerous enemy creature"],
    artStyle: "pixel art",
    colorPalette: "vibrant colors",
    mood: "exciting and action-packed",
  };

  // Attempt 1
  let result = await callIdentificationClaude(anthropic, prompt, gdd).catch(() => null);

  // Retry once on invalid/malformed output
  if (!result) {
    result = await callIdentificationClaude(anthropic, prompt, gdd).catch(() => null);
  }

  if (result) return result;

  // Both attempts failed — use fallback
  return {
    sprites: [
      { name: "player", description: "game hero character, colorful, detailed", type: "player" },
      { name: "enemy", description: "dangerous enemy creature, menacing", type: "enemy" },
    ],
    backgroundDescription: `${prompt} game environment`,
    context: fallbackContext,
  };
}

// ─── Style consistency check (post-generation) ────────────────────────────────

async function runConsistencyCheck(
  apiKey: string,
  gdd: string,
  sprites: GeneratedSprite[],
  background: GeneratedSprite | null,
  context: GameContext,
): Promise<string[]> {
  if (sprites.length === 0) return [];

  const allItems = [
    ...(background ? [`bg (background): ${background.description}`] : []),
    ...sprites.map((s) => `${s.name}: ${s.description}`),
  ].join("\n");

  const anthropic = new Anthropic({ apiKey, timeout: 20_000 });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    temperature: 0.1,
    system: "You are a game art director reviewing visual consistency. Output ONLY valid JSON, no markdown.",
    messages: [{
      role: "user",
      content: `Game world: ${context.setting}, ${context.artStyle}, ${context.colorPalette}, ${context.mood}\n\nGame design:\n${gdd.slice(0, 600)}\n\nSprites generated:\n${allItems}\n\nList any sprite names (not "bg") whose description clearly does NOT match the game world above. Return JSON: {"inconsistent": ["name1"]} or {"inconsistent": []} if all fit.`,
    }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
    return Array.isArray(parsed.inconsistent)
      ? (parsed.inconsistent as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

// ─── Sequential per-sprite generation for background sprite endpoint ──────────

/**
 * Generates sprites one at a time for a saved game.
 * Called after the game code is saved so each sprite can be persisted to DB
 * and injected live into the running iframe via postMessage.
 */
export async function generateSpritesForGame(
  apiKey: string,
  gamePlan: string,
  prompt: string,
  gameContextJson: string | null,
  onStatus: (msg: string) => void,
  onSpriteReady: (sprite: GeneratedSprite) => Promise<void>,
): Promise<{ sprites: GeneratedSprite[]; backgroundSprite: GeneratedSprite | null }> {
  if (!process.env.REPLICATE_API_KEY) return { sprites: [], backgroundSprite: null };

  onStatus("Identifying visual elements...");
  const { sprites: specs, backgroundDescription, context: derivedContext } =
    await identifyVisualElements(apiKey, gamePlan, prompt);

  // Use stored gameContext for prompt consistency, fall back to derived
  let context: GameContext = derivedContext;
  if (gameContextJson) {
    try {
      const parsed = JSON.parse(gameContextJson);
      if (isValidContext(parsed)) context = parsed;
    } catch { /* use derived */ }
  }

  const baseUrl = getBaseUrl();
  const sprites: GeneratedSprite[] = [];
  let backgroundSprite: GeneratedSprite | null = null;

  // Background first (widest aspect ratio → scenic prompt)
  onStatus("Generating background...");
  try {
    const bgPrompt = `${backgroundDescription}, ${context.artStyle}, ${context.colorPalette}, atmospheric game background, ${context.mood}, detailed environment, no characters, no UI, no text, pixel art`;
    const objectPath = await generateSpriteFromPrompt(bgPrompt, "4:3");
    backgroundSprite = { name: "bg", objectPath, url: `${baseUrl}/api/storage${objectPath}`, description: backgroundDescription };
    await onSpriteReady(backgroundSprite);
  } catch { /* non-critical: skip bg on failure */ }

  // Entity sprites one at a time so each appears live as it completes
  for (const spec of specs) {
    onStatus(`Generating ${spec.name} sprite...`);
    try {
      const replicatePrompt = buildReplicatePrompt(spec, context);
      const objectPath = await generateSpriteFromPrompt(replicatePrompt, "1:1");
      const sprite: GeneratedSprite = {
        name: spec.name,
        objectPath,
        url: `${baseUrl}/api/storage${objectPath}`,
        description: spec.description,
      };
      sprites.push(sprite);
      await onSpriteReady(sprite);
    } catch { /* non-critical: skip sprite on failure */ }
  }

  return { sprites, backgroundSprite };
}

// ─── Step 2: Generate all images in parallel ──────────────────────────────────

export async function generateGameSprites(
  apiKey: string,
  gdd: string,
  prompt: string,
  onStatus: (msg: string) => void,
): Promise<{ sprites: GeneratedSprite[]; backgroundSprite: GeneratedSprite | null; context: GameContext | null }> {
  if (!process.env.REPLICATE_API_KEY) {
    return { sprites: [], backgroundSprite: null, context: null };
  }

  onStatus("Identifying visual elements...");
  const { sprites: specs, backgroundDescription, context } = await identifyVisualElements(apiKey, gdd, prompt);

  onStatus("Generating sprites...");

  const baseUrl = getBaseUrl();

  // ── Background — prompt grounded in GDD context ──────────────────────────
  const bgTask = async (): Promise<GeneratedSprite> => {
    const bgPrompt = `${backgroundDescription}, ${context.artStyle}, ${context.colorPalette}, atmospheric game background, ${context.mood}, detailed environment, no characters, no UI, no text, 800x600, pixel art`;
    const objectPath = await generateSpriteFromPrompt(bgPrompt, "4:3");
    return { name: "bg", objectPath, url: `${baseUrl}/api/storage${objectPath}`, description: backgroundDescription };
  };

  // ── Character sprites — prompts grounded in GDD context ──────────────────
  const spriteTasks = specs.map(async (spec): Promise<GeneratedSprite> => {
    const replicatePrompt = buildReplicatePrompt(spec, context);
    const objectPath = await generateSpriteFromPrompt(replicatePrompt, "1:1");
    return { name: spec.name, objectPath, url: `${baseUrl}/api/storage${objectPath}`, description: spec.description };
  });

  // Run everything in parallel — per-element failures fall back gracefully
  const results = await Promise.allSettled([bgTask(), ...spriteTasks]);

  const bgResult = results[0];
  let backgroundSprite = bgResult.status === "fulfilled" ? bgResult.value : null;

  let sprites = results
    .slice(1)
    .filter((r): r is PromiseFulfilledResult<GeneratedSprite> => r.status === "fulfilled")
    .map((r) => r.value);

  // ── Style consistency check — re-generate flagged sprites once ────────────
  try {
    const flagged = await runConsistencyCheck(apiKey, gdd, sprites, backgroundSprite, context);
    if (flagged.length > 0) {
      const regenTasks = flagged
        .map((name) => specs.find((s) => s.name === name))
        .filter((spec): spec is SpriteSpec => !!spec)
        .map(async (spec) => {
          const replicatePrompt = buildReplicatePrompt(spec, context);
          const objectPath = await generateSpriteFromPrompt(replicatePrompt, "1:1");
          return { name: spec.name, objectPath, url: `${baseUrl}/api/storage${objectPath}`, description: spec.description };
        });

      const regenResults = await Promise.allSettled(regenTasks);
      for (const r of regenResults) {
        if (r.status === "fulfilled") {
          const idx = sprites.findIndex((s) => s.name === r.value.name);
          if (idx !== -1) sprites[idx] = r.value;
        }
      }
    }
  } catch { /* consistency check is non-critical — keep original sprites on any failure */ }

  return { sprites, backgroundSprite, context };
}
