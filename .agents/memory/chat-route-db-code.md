---
name: Chat route DB-authoritative code
description: How the chat edit route works — DB is source of truth for live game code, not client-sent currentCode.
---

## Rule
The `/games/:id/chat` route always fetches `currentCode` (or falls back to `gameCode`) from the DB and uses that as Claude's context. The client-sent `currentCode` field is deprecated and ignored server-side.

## Why
Without this, Claude would get the original generated code on every edit instead of the latest edited version. Multiple sequential AI edits would overwrite each other rather than building on previous work.

## How it works
1. Fetch `game.currentCode`, `game.codeVersion`, `game.gameCode` from DB.
2. `liveCode = game.currentCode ?? game.gameCode`
3. Detect `isPhaser = liveCode.includes("Phaser")`
4. Send `liveCode` as context to Claude (Attempt 1)
5. Validate response: must start with `<`, >80 non-empty lines, and if Phaser: has `Phaser.Scene`, `create(`, `update(`
6. If validation fails, send correction message (Attempt 2)
7. If Attempt 2 also fails, return 422 — game unchanged in DB
8. On success: `UPDATE games SET current_code = ..., code_version = N+1`
9. Return `{ updatedCode, changeSummary, codeVersion }`

## PATCH route
When `gameCode` is updated via PATCH (manual save), also set `currentCode = gameCode` to keep them in sync.

## API contract
`currentCode` in `GameChatRequest` is now optional/deprecated — made optional in OpenAPI spec, Zod schema, and TypeScript types. Clients may still send it (backwards compat) but server ignores it.

## DB columns added
```sql
ALTER TABLE games ADD COLUMN IF NOT EXISTS current_code text;
ALTER TABLE games ADD COLUMN IF NOT EXISTS code_version integer NOT NULL DEFAULT 0;
```
