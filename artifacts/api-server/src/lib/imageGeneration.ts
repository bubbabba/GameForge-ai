import Replicate from "replicate";
import { eq } from "drizzle-orm";
import { db, gamesTable } from "@workspace/db";
import { uploadImageFromUrl } from "./imageStorage";

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

/**
 * Generate a game cover via Replicate Flux Schnell, upload to GCS, and persist
 * the objectPath to games.coverImageUrl.  Returns the new objectPath.
 */
export async function generateAndSaveCover(
  gameId: number,
  title: string,
  genre: string,
): Promise<string> {
  const replicate = getReplicateClient();

  const prompt = `Epic dramatic game cover art for a video game called "${title}", ${genre} genre. Cinematic dark atmosphere, moody lighting, professional digital painting, ultra-detailed, no text, no letters, no watermarks, landscape widescreen`;

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
 */
export async function generateSprite(description: string): Promise<string> {
  const replicate = getReplicateClient();

  const prompt = `pixel art sprite of ${description}, retro video game style, clean pixel art, bright bold colors, simple design, game character sprite sheet, transparent-style white background`;

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
