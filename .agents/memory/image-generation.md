---
name: Image generation setup
description: Replicate API for cover/sprite generation, GCS server-side upload, storage route decisions
---

## Rules

**Replicate model:** `black-forest-labs/flux-schnell` for both covers and sprites. `stability-ai/sdxl` returns 404 (removed from Replicate). Flux Schnell uses `aspect_ratio` ("16:9" for covers, "1:1" for sprites) instead of `width`/`height`, has no `negative_prompt`, and accepts `go_fast: true`, `output_format`, `output_quality`. Output elements are FileOutput objects — extract URL via `first.url().toString()` (with `typeof first?.url === "function"` guard, falling back to `String(first)`).

**Server-side GCS upload:** Do NOT use presigned PUT URLs (those are for client-side). Instead use `objectStorageClient.bucket(bucketName).file(objectName).save(buffer, { contentType, resumable: false })` directly. Parse `PRIVATE_OBJECT_DIR` as `"/bucketName/path/prefix"` — strip leading slash, split on `/`, first part = bucket name, rest = object name prefix.

**Object path convention:** Saves at `${PRIVATE_OBJECT_DIR}/images/${uuid}`. Returns `/objects/images/${uuid}`. Storage route (`GET /storage/objects/*path`) reconstructs `objectEntityPath = PRIVATE_OBJECT_DIR + "/images/" + uuid`. These must match exactly.

**Storage access control decision:** `/storage/objects/*` is explicitly public (no auth/ACL) because all stored objects are AI-generated game media (covers, sprites) that appear on the public Explore page. If private user files are ever added, they must use a different path prefix with auth enforcement.

**Zod in api-server:** `zod` must be a direct dependency of `@workspace/api-server` (not just a transitive dep via api-zod). Run `pnpm --filter @workspace/api-server add zod` if it's missing.

**Drizzle update type limitation:** `db.update(gamesTable).set({ coverImageUrl })` may fail with Drizzle's strict column type when the dist hasn't been rebuilt after schema changes. Always rebuild lib/db first. As a last resort, use `.set({ coverImageUrl } as any)`.

**Frontend serving URL:** objectPath `/objects/images/{uuid}` → serving URL `/api/storage/objects/images/{uuid}`. Frontend constructs: `` `/api/storage${objectPath}` ``.

**Fire-and-forget cover gen:** Triggered in `POST /games` after `res.status(201).json(game)`. Uses `generateAndSaveCover(id, title, genre).catch(() => {})`. Only fires when `REPLICATE_API_KEY` is set.

**List routes must include coverImageUrl:** Both `/games/public` and `/games/my` use explicit column selects — must add `coverImageUrl: gamesTable.coverImageUrl` or covers won't appear on GameCard.

**Why:**
- Presigned URLs only work for authenticated users who initiate the upload themselves; server-side saves bypass this correctly.
- Making cover images publicly accessible aligns with the product (public game library).
- List routes use explicit selects for performance (avoid fetching full game code in lists).

**How to apply:** When adding new columns to gamesTable that need to appear in list views, always add them to both the `/games/public` and `/games/my` select objects in `routes/games.ts`.
