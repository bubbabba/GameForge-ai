---
name: Auto sprite generation pipeline
description: How AI sprites are auto-generated during game creation and stored/loaded across the stack.
---

## Overview

When a 2D game is generated, the server automatically creates pixel-art sprites before building the Phaser code. Every image (sprites, background, cover, editor-regenerated sprites) is grounded in the actual GDD Claude wrote.

## Server pipeline (generate2d.ts + generateGameSprites.ts)

1. **Planning** — Claude writes a GDD (max 1024 tokens, 1 retry on transient failure)
2. **Visual element + context extraction** — ONE Claude call (claude-sonnet-4-6, 800 tokens, temp 0.3) reads the GDD and returns:
   - Sprite specs: `{name, description, type}[]`
   - Background description (exact setting from GDD)
   - **GameContext**: `{setting, playerDescription, enemyDescriptions[], artStyle, colorPalette, mood}` — all extracted verbatim from GDD
   - Validated with `isValidContext()` — retries once if invalid
3. **Sprite generation** — All images generated in parallel via `Promise.allSettled` using Replicate `black-forest-labs/flux-schnell`. Each prompt uses GameContext fields.
4. **Style consistency check** — Second Claude call lists generated sprites and asks which don't fit the GDD. Flagged sprites are re-generated once.
5. **Builder** — Claude builds Phaser code with `this.load.image` calls injected for only the sprites that succeeded.

## Prompt templates (per spec)

- **Player**: `pixel art sprite of [desc], in a [setting] environment, [palette] colors, [mood] tone, transparent background, game sprite sheet, 64x64`
- **Enemy**: `pixel art sprite of [desc], [desc] abilities reflected in visual design, fits in a [setting], [palette] colors, [mood] atmosphere, transparent background, menacing, detailed, 64x64`
- **Item**: `pixel art game item, [desc], fits the theme of [setting], [palette], transparent background, glowing effect, 64x64`
- **Background**: `[bgDesc], [artStyle], [palette], atmospheric game background, [mood], detailed environment, no characters, no UI, no text, 800x600, pixel art`
- **Cover**: `Professional game cover art for a game called "[title]", set in [setting], featuring [playerDescription] facing [mainEnemy], [palette] color scheme, [mood] atmosphere, dramatic lighting, cinematic composition, game cover style, high quality digital art, 16:9, no text`
- **Editor regen**: `pixel art sprite of [userDesc], fits the theme of [setting], [artStyle], [palette] colors, [mood] tone, transparent background, game character sprite, 64x64`

## GameContext — the consistency anchor

GameContext is the structured data extracted from the GDD that ties all images together.

- **Extracted during**: sprite identification (same Claude call, no extra cost)
- **Validated**: `isValidContext()` checks all 6 fields are non-empty strings; retries once
- **Stored in DB**: `games.game_context TEXT` column (JSON string)
- **Used by**: cover generation (`/generate-cover`), editor sprite regen (`/generate-sprite`), both routes select `gameContext` from DB
- **3D games / no Replicate key**: `gameContext` is null — cover falls back to generic genre prompt gracefully

## DB storage

- `games.game_plan TEXT` — GDD Claude wrote in Step 1
- `games.game_context TEXT` — Serialized GameContext JSON
- `games.sprites_json TEXT` — JSON array of `{name, url: objectPath, description}[]` (background stored as `name: "bg"`)

## GameContext threading

1. `generateGameSprites()` returns `context: GameContext | null`
2. `generate2DGame()` stores it, returns `gameContext: GameContext | null`
3. Route SSE result includes `gameContextJson: JSON.stringify(gameContext)`
4. `Home.tsx` persists `gamePlan` + `gameContext` (from SSE) in `POST /api/games` body
5. **Guest save**: `guestPreview` state carries `spritesJson`, `gamePlan`, `gameContextJson`; `handleGuestSave` includes all three in the save payload — no context loss for guest sign-in flow

## Schema migration commands

```sql
ALTER TABLE games ADD COLUMN IF NOT EXISTS sprites_json TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_plan TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_context TEXT;
```

**Why psql**: drizzle-kit push isn't wired to a CLI in this project; psql is the reliable path.
