---
name: Auto sprite generation pipeline
description: How AI sprites are auto-generated during game creation and stored/loaded across the stack.
---

## Overview

When a 2D game is generated, the server automatically creates pixel-art sprites before building the Phaser code. The game uses real images instead of colored rectangles.

## Server pipeline (generate2d.ts + generateGameSprites.ts)

1. **Planning** — Claude writes a GDD (max 1024 tokens, 1 retry on transient failure)
2. **Sprite identification** — Claude (claude-sonnet-4-6, 512 tokens, temp 0.3) reads the GDD and returns JSON list of sprites needed: `{"sprites":[{"name":"player","description":"...","type":"player"},...], "background":"..."}`
3. **Sprite generation** — All images generated in parallel via `Promise.allSettled` using Replicate `black-forest-labs/flux-schnell`. Background: 4:3 aspect ratio. Characters: 1:1.
4. **Builder** — Claude builds the Phaser code with `this.load.image` calls injected for ONLY the sprites that succeeded. Missing sprites fall back to `this.add.graphics()` per the builder prompt.

## URL strategy

- Sprites stored in GCS, accessed via proxy: `/api/storage/objects/images/{uuid}`
- **objectPath** (`/objects/images/{uuid}`) — stored in DB spritesJson, used for sidebar thumbnails as `/api/storage${objectPath}`
- **absolute URL** (`https://${REPLIT_DEV_DOMAIN}/api/storage${objectPath}`) — embedded in Phaser game code via `this.load.image()`
- `REPLIT_DEV_DOMAIN` env var is set in both dev and deployed environments

## DB storage

- `games.sprites_json TEXT` column — JSON array of `{name, url: objectPath, description}[]`
- Background stored with `name: "bg"`, excluded from the editor Sprites panel
- Sprites panel shows only `name !== "bg"` entries

## Graceful fallback

- If `REPLICATE_API_KEY` is absent → skips entirely, builder uses graphics primitives
- If individual sprite generation fails → that entity uses graphics (builder is told which keys are available)
- If sprite identification Claude call fails → falls back to `[player, enemy]` defaults

## SSE status events

The generate route emits status events consumed by streamPost's `onStatus` callback:
1. "Designing your game..."
2. "Identifying visual elements..."
3. "Generating sprites..."
4. "Building game code..."

These are shown in the button text on Home.tsx during generation.

## spritesJson lifecycle

1. **Created**: game generation → SSE result includes `sprites` + `backgroundSprite`
2. **Saved**: Home.tsx serializes to JSON string, passes as `spritesJson` in `POST /api/games`
3. **Loaded**: GameEditor.tsx `useEffect` on game load: `JSON.parse(game.spritesJson)`, filters out `bg`, sets `sprites` state
4. **Updated**: When user generates new sprite in editor, `generateSpriteMutation.onSuccess` PATCHes `/api/games/:id` with updated `spritesJson`

## Schema migration command

```
psql "$DATABASE_URL" -c "ALTER TABLE games ADD COLUMN IF NOT EXISTS sprites_json TEXT;"
```

**Why:** `drizzle-kit push` isn't wired to a migration CLI in this project; psql is the reliable path.
