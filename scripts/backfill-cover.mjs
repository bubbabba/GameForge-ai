/**
 * Standalone backfill: generate a cover for game id=2 using the live
 * REPLICATE_API_KEY and upload to GCS object storage.
 */
import { createRequire } from "module";
import { randomUUID } from "crypto";

const require = createRequire(import.meta.url);

// --- resolve packages from pnpm store ---
const Replicate = (await import("/home/runner/workspace/node_modules/.pnpm/replicate@1.4.0/node_modules/replicate/index.js")).default;
const { Storage } = await import("/home/runner/workspace/node_modules/.pnpm/@google-cloud+storage@7.21.0/node_modules/@google-cloud/storage/build/cjs/src/index.js");
const pg = await import("/home/runner/workspace/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js");
const { Pool } = pg.default ?? pg;

const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;
const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR;
const DATABASE_URL = process.env.DATABASE_URL;

if (!REPLICATE_API_KEY) throw new Error("REPLICATE_API_KEY not set");
if (!PRIVATE_OBJECT_DIR) throw new Error("PRIVATE_OBJECT_DIR not set");
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

// Parse bucket name / prefix from PRIVATE_OBJECT_DIR
// e.g. "/bucket-name/.private" → bucket="bucket-name", prefix=".private"
const dirParts = (PRIVATE_OBJECT_DIR.startsWith("/") ? PRIVATE_OBJECT_DIR.slice(1) : PRIVATE_OBJECT_DIR).split("/");
const bucketName = dirParts[0];
const pathPrefix = dirParts.slice(1).join("/");

console.log(`Bucket: ${bucketName}, prefix: ${pathPrefix}`);

// 1. Generate cover via Replicate
const replicate = new Replicate({ auth: REPLICATE_API_KEY });

const gameTitle = "Backrooms Game [3D FP Horror]";
const genre = "Horror";

console.log("⏳ Calling Replicate Flux Schnell…");
const output = await replicate.run("black-forest-labs/flux-schnell", {
  input: {
    prompt: `Epic dramatic game cover art for a video game called "${gameTitle}", ${genre} genre. Cinematic dark atmosphere, moody lighting, professional digital painting, ultra-detailed, no text, no letters, no watermarks, landscape widescreen`,
    aspect_ratio: "16:9",
    num_outputs: 1,
    output_format: "png",
    output_quality: 90,
    go_fast: true,
  },
});

const first = output?.[0];
if (!first) throw new Error("Replicate returned no output");
// Flux Schnell returns FileOutput objects with a .url() method
const imageUrl = typeof first?.url === "function" ? first.url().toString() : (typeof first === "string" ? first : String(first));
console.log("✅ Replicate done:", imageUrl);

// 2. Download image
console.log("⏳ Downloading image…");
const resp = await fetch(imageUrl, { signal: AbortSignal.timeout(90_000) });
if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
const buffer = Buffer.from(await resp.arrayBuffer());
console.log(`✅ Downloaded ${buffer.byteLength} bytes`);

// 3. Upload to GCS
const objectId = randomUUID();
const objectName = pathPrefix ? `${pathPrefix}/images/${objectId}` : `images/${objectId}`;
console.log(`⏳ Uploading to gs://${bucketName}/${objectName}…`);

const storage = new Storage();
const file = storage.bucket(bucketName).file(objectName);
await file.save(buffer, { contentType: "image/png", resumable: false });
console.log("✅ Uploaded to GCS");

// 4. Persist objectPath to DB
const objectPath = `/objects/images/${objectId}`;
const pool = new Pool({ connectionString: DATABASE_URL });
await pool.query("UPDATE games SET cover_image_url = $1 WHERE id = $2", [objectPath, 2]);
await pool.end();
console.log(`✅ DB updated: games.cover_image_url = ${objectPath}`);
console.log(`\nServed at: /api/storage${objectPath}`);
