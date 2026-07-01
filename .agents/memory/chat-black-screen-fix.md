---
name: Chat editor black screen root causes
description: Two bugs that caused iframe to go black after AI chat edits; both fixed.
---

## Bug 1 — `<\/script>` escaping breaks srcDoc iframes

The chat route was applying `finalHtml.replace(/<\/script>/gi, "<\\/script>")` before DB persistence.

In a `srcDoc` iframe the browser's HTML parser looks for the literal sequence `</script` to close a script block. `<\/script` has a backslash after `<`, so it never matches → the script tag never closes → the parser eats the rest of the document as script content → black screen.

**Why the escaping exists in generate2d/generate3d:** Those files embed Claude's raw JS output *inside* an outer `<script>` tag in a wrapper shell. If Claude's JS contains the string `</script>` (e.g. in a comment or string literal), it would prematurely close the outer tag. The escaping there is correct and intentional.

**Chat route is different:** Claude returns a complete self-contained HTML document, not bare JS. No injection into an outer script tag occurs. The `</script>` tags are structural and must not be escaped.

**Fix:** Removed the `replace` line from the chat route. The corrected code just does `const updatedCode = finalHtml`.

## Bug 2 — `max_tokens: 8000` too low for full-game rewrites

Game code grows to 18–20k chars (~5k tokens) after a few edits. Claude must output the **entire** updated game back. At 8000 output tokens it regularly hits the limit mid-HTML, producing truncated responses that sometimes slip past the validator and get saved as broken code.

**Fix:** Raised `max_tokens` to 16000 in:
- Both chat route attempts (games.ts)
- generate2d.ts builder call
- generate3d.ts generation call

## Additional hardening added

- `validateChatHtml` now requires `</html>` to be present — truncated responses never have it.
- `stop_reason === "max_tokens"` from the Anthropic response is treated as an immediate validation failure, forcing the correction round-trip with a clear "Response was cut off" message instead of silently passing broken HTML.

**Why:** The validator was only checking line count and Phaser keywords — a truncated game could pass both checks while missing closing tags/scripts, rendering as a black screen.
