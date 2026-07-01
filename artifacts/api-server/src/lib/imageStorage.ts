import { randomUUID } from "crypto";
import { objectStorageClient } from "./objectStorage";

/**
 * Download an image from an external URL (e.g. from Replicate) and upload it
 * directly to GCS via the Replit object-storage sidecar.
 *
 * Returns the objectPath (e.g. "/objects/images/{uuid}") that can be served by
 * GET /api/storage/objects/images/{uuid}.
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  contentType = "image/png",
): Promise<string> {
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateObjectDir) throw new Error("PRIVATE_OBJECT_DIR not set — object storage not configured");

  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`Failed to download image: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());

  const objectId = randomUUID();
  const fullPath = `${privateObjectDir}/images/${objectId}`;
  // fullPath: "/bucketName/path/prefix/images/{uuid}" — strip leading slash then split
  const parts = (fullPath.startsWith("/") ? fullPath.slice(1) : fullPath).split("/");
  const bucketName = parts[0];
  const objectName = parts.slice(1).join("/");

  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  await file.save(buffer, { contentType, resumable: false });

  return `/objects/images/${objectId}`;
}
