---
name: AI chat editor panel
description: Architecture and correctness rules for the GameEditor chat panel and related backend changes.
---

## Layout (post-rebuild)

```
[Header]
  [Left Sidebar: file explorer + settings]
  [ResizablePanelGroup direction="horizontal"]
    [Center: iframe game preview]
    [ResizableHandle]
    [Right Panel]
      [ResizablePanelGroup direction="vertical"]
        [CodeMirror editor (top)]
        [ResizableHandle withHandle]
        [ChatPanel (bottom)]
```

ChatPanel toolbar: Undo / Redo / Reset / Copy / Fullscreen (above messages)
Quick chips: 8 preset messages above input
Input: auto-expand textarea + char count + voice (Web Speech API) + send button

## State correctness rules

**Undo/Redo stacks must be cleared on game switch.**
`undoStack.current`, `redoStack.current`, `undoCount`, `redoCount`, and `originalCode.current` are all reset inside the `useEffect` that fires when `game.id` changes (`initializedForId` guard). Forgetting this allows undo/redo/reset to cross game boundaries.

`undoCount`/`redoCount` are React state integers that mirror `undoStack.current.length` / `redoStack.current.length` — kept in sync manually on every push/pop. They exist only to trigger re-renders for `canUndo`/`canRedo` derived values.

Any new AI edit clears `redoStack` (redo is only valid for undone changes).

## Backend: chat route (/api/games/:id/chat)

**CHANGE: extraction must only scan the tail after </html>.**
The full response body can contain "CHANGE:" inside HTML comments or JS strings. Extract `changeSummary` ONLY from `rawFull.slice(htmlEnd).trim()`, not the full body. The HTML boundary uses case-insensitive `lastIndexOf` on `.toLowerCase()`.

System prompt: full spec wording ("expert game developer who built this game") + instruction to write `CHANGE: [one sentence]` after the closing `</html>` tag.

Returns: `{ updatedCode, changeSummary? }`.

## Generated type locations

`changeSummary?: string` must be present in ALL of:
- `lib/api-client-react/src/generated/api.schemas.ts` (interface `GameChatResponse`)
- `lib/api-zod/src/generated/api.ts` (zod schema `ChatEditGameResponse`)
- `lib/api-zod/src/generated/types/gameChatResponse.ts` (interface `GameChatResponse`)

After editing src files, rebuild BOTH dist folders:
```
pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json
pnpm --filter @workspace/api-zod exec tsc -p tsconfig.json
```
TypeScript resolves from `dist/*.d.ts` (composite project), not from src.

## Auto-revert guard (frontend)

If `updatedCode.length < 200` or doesn't start with `<`, pop the optimistic undo entry and show an error — do not apply the code. The backend already validates this too, but double-check on client for defense in depth.
