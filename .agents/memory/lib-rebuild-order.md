---
name: Lib rebuild order
description: Required build sequence after changes to shared libraries in the monorepo.
---

## Rule
After any change to `lib/db/src/schema/`, `lib/api-spec/openapi.yaml`, `lib/api-zod/src/`, or `lib/api-client-react/src/`, rebuild in this order:

1. `pnpm --filter @workspace/db exec tsc -p tsconfig.json`
2. `pnpm --filter @workspace/api-zod exec tsc -p tsconfig.json`
3. `pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json`

Then verify:
- `pnpm --filter @workspace/api-server exec tsc --noEmit`
- `pnpm --filter @workspace/gameforge-ai exec tsc --noEmit`

## Why
TypeScript resolves types from `dist/*.d.ts`, not `src/`. Skipping a rebuild causes phantom "property does not exist" errors in downstream packages even though the source is correct. This is especially confusing when gamesTable columns are missing from the inferred Drizzle types.

## Note on generated files
`lib/api-client-react` and `lib/api-zod` have NO codegen script — all files under `src/generated/` are edited manually. After any openapi.yaml change, manually update the generated TypeScript types, then rebuild.
