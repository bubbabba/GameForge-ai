---
name: Prompt Length & Zod Error Display Fix
description: Generation was failing silently for prompts over 1000 chars; Zod errors were shown as raw JSON.
---

## Fix
- `MAX_PROMPT_LENGTH` raised from 1000 → 4000 characters in `artifacts/api-server/src/routes/games.ts`.
- Zod validation error format changed from `parsed.error.message` (raw JSON string) to `${field}: ${msg}` using `parsed.error.issues[0]`.

**Why:** 1000 chars is ~200 words — fine for simple prompts but rejects any detailed game description. Raw Zod messages showed as unreadable JSON in the UI error toast.

**How to apply:** Any future validation error responses should extract `issues[0]` for a human-readable message, not use `.message` directly.
