- [AI chat editor panel](ai-chat-editor.md) — POST /games/:id/chat + 4-panel GameEditor; race condition fix: textarea locked (readOnly) while isThinking.
- [Prompt length fix](prompt-length-fix.md) — MAX_PROMPT_LENGTH was 1000 chars (rejecting detailed prompts); raised to 4000. Zod errors now return human-readable field:message instead of raw JSON.
- [Phaser template edit hazard](phaser-template-edit-hazard.md) — Edit tool mangles '
 inside phaserTemplates.ts template literals; always use Python for edits touching that char.
