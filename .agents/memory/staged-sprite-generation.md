---
name: Staged sprite generation
description: Architecture of the two-stage game generation flow — Stage 1 fast code build, Stage 2 background sprite generation with live injection.
---

## Stage 1 — generate2DGame
- No Replicate calls; `identifyVisualElements()` extracts sprite specs (names, descriptions, context)
- Game code uses SVG data-URI colored placeholders in Phaser preload
- `SPRITE_SWAP_LISTENER` appended to every 2D game's JS — listens for `{type:'spriteReady', name, url}` postMessage and swaps Phaser textures live
- Returns `{needsSpriteGeneration, gameContext}` (NOT sprites)
- `var game = new Phaser.Game(config)` must remain in builder prompt so the listener can access the game object

## Stage 2 — POST /games/:id/generate-sprites (SSE)
- Called automatically by GameEditor when `game.generationStatus === 'sprites_pending'`
- Atomically claims job: `UPDATE games SET generation_status='generating' WHERE generation_status != 'generating'` → 409 if already running
- Error path resets to `generation_status='sprites_error'` so user can retry
- Calls `generateSpritesForGame()` (sequential, one at a time): background first, then entity sprites
- Each sprite: DB update (read-then-write; safe since sequential within one request) + SSE `{type:'sprite_ready'}` + postMessage to iframe
- On completion: sets `generation_status='complete'`

## generationStatus lifecycle
`sprites_pending` → `generating` (claimed) → `complete` or `sprites_error`

## Frontend (GameEditor.tsx)
- `iframeRef` on iframe for postMessage injection
- `spriteGenStartedForId` ref prevents duplicate auto-triggers per session
- `sprites` state is now `SpriteEntry[]` (includes `name` field + bg sprite)
- `rightTab: 'code' | 'assets'` — tabs above right panel; Assets tab shows AssetsPanel
- AssetsPanel: sections for Background/Player/Enemies/Items/Cover; Regen (editable prompt), Download per sprite
- Error state in AssetsPanel shows "Retry Generation" button (resets spriteGenStartedForId ref)
- onRetryGeneration resets the guard ref so re-trigger is possible

## DB / type chain
- `generation_status TEXT NOT NULL DEFAULT 'complete'` added to games table
- SQL migration: `ALTER TABLE games ADD COLUMN IF NOT EXISTS generation_status TEXT NOT NULL DEFAULT 'complete';`
- Rebuild order after schema changes: lib/db → api-zod → api-client-react (npx tsc -p tsconfig.json)

## Known limitation
Sequential sprite DB writes within one request have no transaction — safe against self-race but not against concurrent HTTP requests hitting the same game simultaneously. The generating-status guard prevents this in practice.
