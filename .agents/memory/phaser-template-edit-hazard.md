---
name: Phaser template file edit hazard
description: The Edit tool mangles '$' inside TypeScript template literal strings in phaserTemplates.ts, causing cascading file corruption. Use Python for any edits that touch the '$' character inside those template literals.
---

## Rule
Never use the Edit tool to modify lines inside `phaserTemplates.ts` that contain the `$` character (e.g., `'$'` for Sokoban box detection). The tool interprets `$` as a template variable and truncates the line, breaking the surrounding template literal and producing cascading duplicate shell exports.

**Why:** The Edit tool's old_string/new_string matching processes `$` specially when the content is inside a TypeScript backtick template literal. The result is a truncated line that prematurely closes the template literal, causing all subsequent shells (HORROR_SHELL, RPG_SHELL, PHASER_SHELLS) to appear orphaned and duplicated after the registry block.

**How to apply:** For any fix to the puzzle shell's `_checkWin`, `tryMove`, or any other method that references the `$` character:
1. Use Python (`python3 << 'PYEOF' ... PYEOF`) to open, modify, and write the file directly.
2. Python string literals handle `$` literally without any template interpolation.
3. After fixing, always grep for duplicate `export const HORROR_SHELL` etc. to confirm only one copy of each shell exists.

## Recovery procedure (if corruption happens again)
1. `grep -n "export const HORROR_SHELL" phaserTemplates.ts` — confirms duplicates
2. Python script: read all lines, fix broken line at `_checkWin` section, truncate after `DEFAULT_PHASER_SHELL` line.
3. Run `pnpm --filter @workspace/api-server run typecheck` to confirm clean.
