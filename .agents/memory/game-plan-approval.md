---
name: Game plan approval flow
description: Two-step create flow — Claude generates a structured plan first, user approves/adjusts, then code is generated using the approved plan as the GDD.
---

## The flow

1. `POST /api/games/plan` → Claude outputs JSON plan (title, concept, playerCharacter, mainMechanic, enemies, levelStructure, winCondition, loseCondition, visualStyle, features[])
2. User reviews plan card on Home.tsx — can approve or click "Adjust Plan" to iterate
3. `POST /api/games/plan/refine` → Claude revises plan JSON based on feedback text
4. `POST /api/games/generate` with `approvedPlan` (JSON string of plan) → generate functions receive formatted GDD text, skipping the GDD call

## Key design decisions

**parsePlanJson uses regex extraction, not strip-fences:** `text.match(/\{[\s\S]*\}/)` catches JSON even when Claude wraps it in prose. On parse failure, throws a user-facing error (not a silent fallback) so the user sees the problem.

**approvedPlan flows as formatted text, not raw JSON:** `formatApprovedPlan()` in games.ts converts the plan object to a rich GDD text with labeled sections (TITLE, CORE CONCEPT, PLAYER CHARACTER, etc.). This is what gets passed to generate2d/generate3d as the `approvedPlan` parameter.

**generate2d.ts skips Call 1 (GDD) when approvedPlan provided:** The `approvedPlan` param replaces the first Claude call entirely. Call 1b (visual element extraction) and Calls 2–5 still run as normal, using the approved plan as context.

**generate3d.ts always uses approved plan on all retries:** Retries get a shortened version (`approvedPlan.slice(0, 1000) + "[implement core mechanics only]"`), not the raw prompt. This enforces plan fidelity throughout.

**Stale-plan warning in UI:** `isPlanStale = plan !== null && prompt.trim() !== planPrompt`. When true, an amber warning banner appears in the plan card action area. `planPrompt` is set at the moment the plan is generated, so any subsequent prompt edit triggers the warning.

## Schema changes (api-zod)

Added: `PlanGameBody`, `GamePlanObject`, `PlanGameResponse`, `RefinePlanBody`, `RefinePlanResponse`.
Updated: `GenerateGameBody` now has optional `approvedPlan: string`.
After any api-zod source edit, run `tsc -p tsconfig.json` in lib/api-zod to rebuild dist/.
