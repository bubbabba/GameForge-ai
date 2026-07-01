---
name: SSE resilience pattern for long Claude calls
description: How generate and chat routes use Server-Sent Events to prevent proxy timeouts during 80–150s Claude API calls.
---

## Pattern summary

Long Claude API calls (generate: ~80s, chat: ~90s) were timing out through Replit's proxy. The fix switches both routes to SSE so the connection stays alive.

## Server (games.ts)

1. `startSSE(res)` — sets `Content-Type: text/event-stream`, `X-Accel-Buffering: no`, calls `res.flushHeaders()`, starts a 10s heartbeat interval, returns `stopHeartbeat`.
2. Register `res.on("close", stopHeartbeat)` immediately after `startSSE()` — guarantees cleanup on client disconnect even if Claude is still running.
3. Validation errors (auth, body parse, DB not found) happen BEFORE `startSSE()` and return normal JSON with status codes.
4. `sseResult(res, data)` — writes `data: {"type":"result",...}\n\n` then calls `res.end()`.
5. `sseError(res, msg)` — writes `data: {"type":"error","error":"..."}\n\n` then calls `res.end()`.
6. `withRetry(fn)` — retries once on transient errors; does not retry 401/400.

## Server (index.ts)

```
server.setTimeout(180_000);
server.keepAliveTimeout = 180_000;
server.headersTimeout = 185_000;
```

## Anthropic client timeout

All Anthropic clients: `new Anthropic({ apiKey, timeout: 120_000 })` — in generate2d.ts, generate3d.ts, and games.ts chat route.

## Client (streamPost.ts)

`streamPost<T>(url, body, signal?)` — POST + consumes SSE stream:
- Non-SSE error responses (4xx before stream starts) → throws `{ error: string }`.
- `{"type":"thinking"}` events → ignored (heartbeat).
- `{"type":"result",...}` events → returns rest of payload as T.
- `{"type":"error","error":"..."}` events → throws `{ error: string }`.
- Handles both LF and CRLF line endings; concatenates multi-line `data:` per RFC 8895.
- Stream disconnect → throws with a "Connection dropped" user-facing message.

## Frontend migration

`useGenerateGame()` from api-client-react removed from Home.tsx — replaced with `isGenerating` state + `streamPost`.
`useChatEditGame()` from api-client-react removed from GameEditor.tsx — `handleChatSend` made async, calls `streamPost`.

**Why:** The generated client uses a plain `fetch()` that waits for the full response. SSE requires consuming a ReadableStream, which the generated client doesn't support.

## Health check

`GET /api/health` (alias for `/api/healthz`) returns `{ status: "ok" }` — used by uptime monitors.
