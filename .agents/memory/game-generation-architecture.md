---
name: Game generation architecture
description: How 2D and 3D games are generated — chunked pipeline, models, temperatures, timeouts, and retry strategy.
---

## 2D Generation — 5-call chunked pipeline (generate2d.ts)

Replaced the original single 16k-token call (which timed out) with 5 focused calls.

**Each call**: claude-sonnet-4-6, max_tokens 8000, 65s timeout, up to 3 retries with exponential back-off.

| # | Call | max_tokens | temp | What it produces |
|---|------|-----------|------|-----------------|
| 1 | GDD | 1024 | 0.9 | Game design document (<250 words) |
| 1b | Visual elements | — | — | Sprite specs + GameContext (identifyVisualElements) |
| 2 | Skeleton | 8000 | 0.9 | 4 scene class stubs + player movement, **===ENEMIES=== / ===UI=== placeholders** |
| 3 | Enemy additions | 8000 | 0.9 | ONLY labeled blocks (===ENEMIES_CREATE===…END, ===ENEMIES_UPDATE===…END, ===ENEMY_CLASSES===…END) |
| 4 | UI additions | 8000 | 0.9 | ONLY labeled blocks (===UI_CREATE===…END, ===UI_UPDATE===…END, ===GAMEOVER_SCENE===…END) |
| 5 | Assembly | 8000 | 0.2 | Merges skeleton + enemy blocks + UI blocks + sprite preload → final game |

**Why labeled additions** (not progressive full rewrites): chunks 3/4 produce only their delta, so no call ever needs to output a growing full game that could exceed 8k. The assembler inserts them at the exact named placeholders.

**Why `===*===` / `===*_END===` markers**: deterministic assembly. The assembler prompt lists exact insertion points per marker. Post-assembly, `validateAssembly()` checks that no markers remain in the output.

**Truncation detection** (`detectTruncation()`): last non-empty line must match `/^[}\s]*;?\s*$/`; brace imbalance >2 = truncated.

**Retry helper** (`withChunkRetry`): mutable `retriesRef.count` shared across all chunks, exponential back-off, 4× multiplier on 429/529 errors.

**gamePlan flow**: generated → returned in SSE result → stored in DB → also written to sessionStorage for GameEditor chat → used to re-derive sprite specs at generate-sprites time.

## 3D Generation — single call (generate3d.ts)

| Param | Value |
|-------|-------|
| Model | claude-sonnet-4-6 |
| max_tokens | 8000 (was 16000) |
| Timeout | 65 s (was 120 s) |
| Retries | Up to 3, simplified prompt on retry 2+ |
| Temperature | 0.9 |

Generates only the `gameUpdate(delta)` function + setup code injected into a hardcoded Three.js HTML shell (per-genre).

Truncation detection: same `/^[}\s]*;?\s*$/` last-line check + brace imbalance >2.

**Why:** the old single 120s/16k call timed out frequently. 65s/8k with retry is fast enough for the ~200-line 3D logic output and eliminates the timeout.
