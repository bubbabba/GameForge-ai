import Replicate from "replicate";
import { eq } from "drizzle-orm";
import { db, gamesTable } from "@workspace/db";
import { uploadImageFromUrl } from "./imageStorage";

function getReplicateClient(): Replicate {
  const apiKey = process.env.REPLICATE_API_KEY;
  if (!apiKey) throw new Error("REPLICATE_API_KEY is not configured");
  return new Replicate({ auth: apiKey });
}

async function runModel(client: Replicate, model: string, input: Record<string, unknown>): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output = (await client.run(model as any, { input })) as unknown[];
  const first = output?.[0];
  if (!first) throw new Error("Replicate returned no output");
  // Newer replicate client returns FileOutput objects; String() gives the URL
  return typeof first === "string" ? first : String(first);
}

/**
 * Generate a game cover via Replicate SDXL, upload to GCS, and persist the
 * objectPath to games.coverImageUrl.  Returns the new objectPath.
 */
export async function generateAndSaveCover(
  gameId: number,
  title: string,
  genre: string,
): Promise<string> {
  const replicate = getReplicateClient();

  const prompt = `Epic dramatic game cover art for a video game called "${title}", ${genre} genre. Cinematic dark atmosphere, moody lighting, professional digital painting, ultra-detailed, no text, no letters, no watermarks, 16:9 landscape format`;
  const negativePrompt =
    "text, letters, words, watermark, signature, logo, ugly, blurry, low quality, cropped, distorted";

  const imageUrl = await runModel(replicate, "stability-ai/sdxl", {
    prompt,
    negative_prompt: negativePrompt,
    width: 1024,
    height: 576,
    num_inference_steps: 30,
    guidance_scale: 7.5,
    num_outputs: 1,
  });

  const objectPath = await uploadImageFromUrl(imageUrl, "image/png");

  await db.update(gamesTable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ coverImageUrl: objectPath } as any)
    .where(eq(gamesTable.id, gameId));

  return objectPath;
}

/**
 * Generate a pixel-art sprite via Replicate SDXL and upload to GCS.
 * Returns the objectPath (e.g. "/objects/images/{uuid}").
 */
export async function generateSprite(description: string): Promise<string> {
  const replicate = getReplicateClient();

  const prompt = `pixel art sprite of ${description}, retro video game style, clean pixel art, bright bold colors, simple design, game character sprite, white background, 64x64 pixel art style`;
  const negativePrompt =
    "realistic, photo, 3d render, blurry, ugly, complex background, text, words, low resolution";

  const imageUrl = await runModel(replicate, "stability-ai/sdxl", {
    prompt,
    negative_prompt: negativePrompt,
    width: 1024,
    height: 1024,
    num_inference_steps: 25,
    guidance_scale: 7.5,
    num_outputs: 1,
  });

  return uploadImageFromUrl(imageUrl, "image/png");
}
