---
name: Game generation architecture
description: How the 2D/3D game generation pipeline works after the two-step rebuild.
---

## 2D generation (generate2d.ts)

Two-step Claude pipeline, no template shells:

1. **Step 1 — Planning**: Claude writes a ≤200-word game design document covering mechanic, win/lose, 3 unique features, controls, visual style, difficulty. Model: `claude-sonnet-4-6`, temp: 0.9, max_tokens: 1024.

2. **Step 2 — Build**: Claude builds a complete standalone Phaser 3 game (JS only) from the GDD. Model: `claude-sonnet-4-6`, temp: 0.9, max_tokens: 8000. Result is wrapped in a minimal HTML+CDN page (`WRAPPER_HEAD` + JS + `WRAPPER_FOOT`).

**Validation** (6 checks, auto-retry up to 2 times, hard throw on final failure):
- Contains `Phaser.Scene`
- Has `update(` function
- Has `create(` function
- Has keyboard/input handling
- 100+ non-empty lines
- No `placeholder` or `undefined` (word-level match)

**Returns**: `{ gameCode, title, qualityScore, gamePlan }`

**Why:** Replaced the template-shell injection approach (which limited Claude's creative range) with full autonomous game construction, enabling genuinely unique games per user description.

## 3D generation (generate3d.ts)

Still uses Three.js shells. Updated to: model `claude-sonnet-4-6`, temp 0.9, max_tokens 8000.

## Chat route (routes/games.ts)

Model: `claude-sonnet-4-6`, temp: 0.9, max_tokens: 8000. System prompt: "developer who built this game" framing. Receives full HTML, returns full updated HTML.

## gamePlan threading

- API response: `GameGenerated.gamePlan?: string` (in openapi.yaml → codegen → api-zod + api-client-react)
- Home.tsx: stores plan in `sessionStorage` with key `gamePlan_${id}` before `setLocation(/game/${id})`
- GameEditor.tsx: reads and deletes sessionStorage entry in `useState` initializer, shows plan in first chat bubble via `makeWelcome(plan)`

## Source file edit warning

`phaserTemplates.ts` still exists (used for Sokoban puzzle shell and others) but is no longer imported by `generate2d.ts`. Any future edits to `phaserTemplates.ts` must use Python (not the Edit tool) due to `'$'` in template literals — see `phaser-template-edit-hazard.md`.

## `</script>` in TypeScript source

Any literal string `</script>` in a `.ts` file causes TS1002 "Unterminated string literal". Always use string concatenation: `"</" + "script>"` or a pre-defined constant. Same applies to regex literals — use `new RegExp(...)` form.
