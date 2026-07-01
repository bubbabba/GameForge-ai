/**
 * Auto-generate sprites for a 2D game before the code-build step.
 *
 * 1. Ask Claude (Haiku — fast, cheap) to identify what sprites are needed
 *    from the Game Design Document.
 * 2. Generate background + all character sprites in parallel via Replicate.
 * 3. Return { sprites, backgroundSprite } with both objectPaths (for DB
 *    storage) and absolute URLs (for embedding in Phaser game code).
 */

import Anthropic from "@anthropic-ai/sdk";
import { generateSpriteFromPrompt } from "./imageGeneration";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpriteSpec {
  name: string;        // "player" | "enemy" | "enemy2" | "item" etc.
  description: string; // brief description used to build Replicate prompt
  type: "player" | "enemy" | "item" | "other";
}

export interface GeneratedSprite {
  name: string;
  objectPath: string; // /objects/images/{uuid} — stored in DB, used for sidebar thumbnails
  url: string;        // absolute URL — embedded in Phaser this.load.image()
  description: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Absolute origin of this server — used to build sprite URLs for Phaser. */
function getBaseUrl(): string {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  return domain ? `https://${domain}` : "http://localhost:8080";
}

function buildReplicatePrompt(spec: SpriteSpec): string {
  switch (spec.type) {
    case "player":
      return `pixel art ${spec.description}, game sprite, transparent background, high detail, front facing, vibrant colors, clean outline, 64x64`;
    case "enemy":
      return `pixel art monster sprite, ${spec.description}, transparent background, detailed shading, glowing eyes, menacing expression, full body visible, game ready sprite, high quality pixel art, 64x64 pixels`;
    case "item":
      return `pixel art ${spec.description}, game item sprite, transparent background, glowing, detailed, bright colors, 64x64`;
    default:
      return `pixel art ${spec.description}, game sprite, transparent background, high detail, vibrant colors`;
  }
}

// ─── Step 1: Identify sprites via Claude ─────────────────────────────────────

async function identifyVisualElements(
  apiKey: string,
  gdd: string,
  prompt: string,
): Promise<{ sprites: SpriteSpec[]; backgroundDescription: string }> {
  const anthropic = new Anthropic({ apiKey, timeout: 30_000 });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    temperature: 0.3,
    system: "You are a game asset manager. Output ONLY valid JSON with no markdown fences, no explanation, no extra text.",
    messages: [{
      role: "user",
      content: `Game prompt: ${prompt}\n\nGame design document:\n${gdd}\n\nIdentify every visual element that needs a sprite. Return exactly this JSON structure:\n{"sprites":[{"name":"player","description":"brief description under 10 words","type":"player"},...],"background":"brief description of the game world setting"}\n\nRules:\n- Exactly 1 player entry (name must be "player")\n- 1-3 enemy types (names: "enemy", "enemy2", "enemy3")\n- 0-2 collectible/power-up items (names: "item", "item2")\n- Maximum 6 sprites total\n- Descriptions must be 5-10 words, vivid and specific\n- Background describes the environment/world, not characters`,
    }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
  // Extract JSON even if wrapped in accidental markdown
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  try {
    const parsed = JSON.parse(jsonMatch?.[0] ?? text);
    return {
      sprites: Array.isArray(parsed.sprites) ? (parsed.sprites as SpriteSpec[]).slice(0, 6) : [],
      backgroundDescription: typeof parsed.background === "string" ? parsed.background : prompt,
    };
  } catch {
    // Safe fallback
    return {
      sprites: [
        { name: "player", description: "game hero character, colorful, detailed", type: "player" },
        { name: "enemy", description: "dangerous enemy creature, menacing", type: "enemy" },
      ],
      backgroundDescription: `${prompt} game environment`,
    };
  }
}

// ─── Step 2: Generate all images in parallel ──────────────────────────────────

export async function generateGameSprites(
  apiKey: string,
  gdd: string,
  prompt: string,
  onStatus: (msg: string) => void,
): Promise<{ sprites: GeneratedSprite[]; backgroundSprite: GeneratedSprite | null }> {
  // No Replicate key → skip gracefully (game falls back to graphics primitives)
  if (!process.env.REPLICATE_API_KEY) {
    return { sprites: [], backgroundSprite: null };
  }

  onStatus("Identifying visual elements...");
  const { sprites: specs, backgroundDescription } = await identifyVisualElements(apiKey, gdd, prompt);

  onStatus("Generating sprites...");

  const baseUrl = getBaseUrl();

  // ── Background ─────────────────────────────────────────────────────────────
  const bgTask = async (): Promise<GeneratedSprite> => {
    const bgPrompt = `${backgroundDescription}, game background, detailed, atmospheric, pixel art style, no UI elements, no characters, no text, top-down or side-view perspective`;
    const objectPath = await generateSpriteFromPrompt(bgPrompt, "4:3");
    return {
      name: "bg",
      objectPath,
      url: `${baseUrl}/api/storage${objectPath}`,
      description: backgroundDescription,
    };
  };

  // ── Character sprites ──────────────────────────────────────────────────────
  const spriteTasks = specs.map(async (spec): Promise<GeneratedSprite> => {
    const replicatePrompt = buildReplicatePrompt(spec);
    const objectPath = await generateSpriteFromPrompt(replicatePrompt, "1:1");
    return {
      name: spec.name,
      objectPath,
      url: `${baseUrl}/api/storage${objectPath}`,
      description: spec.description,
    };
  });

  // Run everything in parallel — failures fall back gracefully
  const results = await Promise.allSettled([bgTask(), ...spriteTasks]);

  const bgResult = results[0];
  const backgroundSprite = bgResult.status === "fulfilled" ? bgResult.value : null;

  const sprites = results
    .slice(1)
    .filter((r): r is PromiseFulfilledResult<GeneratedSprite> => r.status === "fulfilled")
    .map((r) => r.value);

  return { sprites, backgroundSprite };
}
