/**
 * Validates AI-generated game code to catch low-quality or placeholder outputs
 * before serving them to users.  Returns null when valid, or a reason string.
 */

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\badd (game |your |some )?(logic|mechanics|code|physics|collision) here\b/i,
  /\bTODO[: ]/,
  /\[ ?TODO ?]/i,
  /\bplaceholder\b/i,
  /\byour code here\b/i,
  /\bimplement (this|later|here|the logic|game logic|collision|movement)\b/i,
  /\bcoming soon\b/i,
  /\binsert (game|code|logic) here\b/i,
  /\bgame logic goes here\b/i,
  /\bput (your|the) (game|code|logic)\b/i,
  /\bfill in (the|your|this)\b/i,
  /\bexample logic\b/i,
  /\badd collision (detection )?here\b/i,
  /\badd enemy logic\b/i,
  /\bcomplete this\b/i,
  /\/\/ \.{3,}\s*$/m,           // "// ..." on its own line
  /\/\* ?\.{3,} ?\*\//,         // /* ... */
];

/**
 * Returns a human-readable failure reason, or null when the code looks complete.
 * @param code   The generated code (full HTML for 2D, JS logic for 3D)
 * @param minLines Minimum number of non-blank lines required
 */
export function getValidationFailure(code: string, minLines = 50): string | null {
  const nonEmpty = code.split("\n").filter((l) => l.trim().length > 0).length;
  if (nonEmpty < minLines) {
    return `Output too short (${nonEmpty} non-empty lines; need ≥ ${minLines})`;
  }
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const m = code.match(pattern);
    if (m) return `Contains placeholder text: "${m[0]}"`;
  }
  return null;
}

/** Convenience boolean wrapper. */
export function isCodeValid(code: string, minLines = 50): boolean {
  return getValidationFailure(code, minLines) === null;
}
