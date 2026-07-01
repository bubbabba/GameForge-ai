import Replicate from "replicate";
import { eq } from "drizzle-orm";
import { db, gamesTable } from "@workspace/db";
import { uploadImageFromUrl } from "./imageStorage";
import type { GameContext } from "./generateGameSprites";

function getReplicateClient(): Replicate {
  const apiKey = process.env.REPLICATE_API_KEY;
  if (!apiKey) throw new Error("REPLICATE_API_KEY is not configured");
  return new Replicate({ auth: apiKey });
}

// Flux Schnell returns an array of FileOutput objects; .url() gives the URL string.
async function runFlux(
  client: Replicate,
  input: Record<string, unknown>,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output = (await client.run("black-forest-labs/flux-schnell", { input })) as any[];
  const first = output?.[0];
  if (!first) throw new Error("Replicate returned no output");
  // FileOutput has .url() method; fall back to String() for plain URLs
  if (typeof first.url === "function") return first.url().toString();
  return typeof first === "string" ? first : String(first);
}

/** Parse gameContext JSON string into a GameContext object. Returns null on failure. */
function parseGameContext(gameContextJson: string | null | undefined): GameContext | null {
  if (!gameContextJson) return null;
  try { return JSON.parse(gameContextJson) as GameContext; } catch { return null; }
}

/**
 * Generate a game cover via Replicate Flux Schnell, upload to GCS, and persist
 * the objectPath to games.coverImageUrl.  Returns the new objectPath.
 *
 * When gameContextJson is provided the prompt is fully grounded in the GDD —
 * exact setting, characters, palette and mood Claude chose for the game.
 */
export async function generateAndSaveCover(
  gameId: number,
  title: string,
  genre: string,
  gameContextJson?: string | null,
): Promise<string> {
  const replicate = getReplicateClient();

  const ctx = parseGameContext(gameContextJson);
  let prompt: string;

  if (ctx) {
    const mainEnemy = ctx.enemyDescriptions[0] ?? "enemies";
    prompt = `Professional game cover art for a game called "${title}", set in ${ctx.setting}, featuring ${ctx.playerDescription} facing ${mainEnemy}, ${ctx.colorPalette} color scheme, ${ctx.mood} atmosphere, dramatic lighting, cinematic composition, game cover style, high quality digital art, 16:9, no text, no letters, no watermarks`;
  } else {
    prompt = `Epic dramatic game cover art for a video game called "${title}", ${genre} genre. Cinematic dark atmosphere, moody lighting, professional digital painting, ultra-detailed, no text, no letters, no watermarks, landscape widescreen`;
  }

  const imageUrl = await runFlux(replicate, {
    prompt,
    aspect_ratio: "16:9",
    num_outputs: 1,
    output_format: "png",
    output_quality: 90,
    go_fast: true,
  });

  const objectPath = await uploadImageFromUrl(imageUrl, "image/png");

  await db.update(gamesTable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ coverImageUrl: objectPath } as any)
    .where(eq(gamesTable.id, gameId));

  return objectPath;
}

/**
 * Generate a pixel-art sprite via Replicate Flux Schnell and upload to GCS.
 * Returns the objectPath (e.g. "/objects/images/{uuid}").
 *
 * When gameContextJson is provided the prompt matches the game's exact world —
 * setting, art style, palette and mood from the original GDD.
 */
export async function generateSprite(
  description: string,
  gameContextJson?: string | null,
): Promise<string> {
  const replicate = getReplicateClient();

  const ctx = parseGameContext(gameContextJson);
  let prompt: string;

  if (ctx) {
    prompt = `pixel art sprite of ${description}, fits the theme of ${ctx.setting}, ${ctx.artStyle}, ${ctx.colorPalette} colors, ${ctx.mood} tone, transparent background, game character sprite, high quality pixel art, 64x64`;
  } else {
    prompt = `pixel art sprite of ${description}, retro video game style, clean pixel art, bright bold colors, simple design, game character sprite sheet, transparent-style white background`;
  }

  const imageUrl = await runFlux(replicate, {
    prompt,
    aspect_ratio: "1:1",
    num_outputs: 1,
    output_format: "png",
    output_quality: 90,
    go_fast: true,
  });

  return uploadImageFromUrl(imageUrl, "image/png");
}

/**
 * Generate an image from an arbitrary prompt with a chosen aspect ratio.
 * Returns the objectPath (e.g. "/objects/images/{uuid}").
 */
export async function generateSpriteFromPrompt(
  prompt: string,
  aspectRatio: "1:1" | "4:3" = "1:1",
): Promise<string> {
  const replicate = getReplicateClient();
  const imageUrl = await runFlux(replicate, {
    prompt,
    aspect_ratio: aspectRatio,
    num_outputs: 1,
    output_format: "png",
    output_quality: 90,
    go_fast: true,
  });
  return uploadImageFromUrl(imageUrl, "image/png");
}
