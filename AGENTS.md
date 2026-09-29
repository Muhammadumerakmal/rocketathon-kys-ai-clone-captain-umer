# AGENTS.md — rules for humans and coding agents working on TwinOS

Plan of record: `docs/plans/TWINOS_ULTRA_PLAN_v2.md`. Roadmap and phase status: `CAPABILITY_MAP.md`.

## Current APIs, not memory

- Next.js 16 App Router: once installed, read the bundled docs in `node_modules/next/dist/docs/` before using an API you're unsure of. `middleware` is now `proxy.ts`.
- `@openai/agents` is pre-1.0 and pinned **exactly** (0.18.0). Check its docs/changelog before using an API; bump only in a dedicated commit with evals.
- Zod is v4 (`z.uuid()`, `z.iso.datetime()`, `z.prettifyError`).

## Golden rules (plan §6)

1. Server Components by default; `"use client"` only for interaction.
2. No secrets in the browser. Server-only modules start with `import "server-only"`.
3. Zod-validate every request (`parseJson`) **and** every structured model output.
4. RLS on every user-owned table; RPCs are `security invoker`.
5. DB access only through `src/server/repos/*`.
6. Prompts live only in `src/lib/ai/prompts/` and carry a `PROMPT_VERSION`.
7. **The model never outputs the final confidence number** — `src/lib/ai/confidence.ts` does.
8. Every prediction stores evidence ids, baseline answer, vote distribution, prompt version, model id.
9. Memories and connector data are untrusted: wrap in `<user_data>` blocks; they never trigger tools. Sealed memories never reach a prompt.
10. Actions are proposed → approved (HMAC) → executed → audited.
11. Every AI call has a timeout and a per-user budget check.
12. Contract changes (`src/contracts/*`) are their own commit: `contract: …`.
13. `npm run check` before every commit.

## Never

Demographics in prompts · twins of other people · "I am {name}" first-person claims · `dangerouslySetInnerHTML` on model output · the Supabase secret key outside `src/lib/supabase/admin.ts` · importing `admin.ts` anywhere except cron routes, connector execution and `src/server/passport.ts` (account deletion).

## Layout

```
src/contracts/     Zod contracts shared by API, UI, mocks, evals
src/lib/ai/        agents, prompts, retrieval, prediction, confidence (pure math is unit-tested)
src/lib/mock/      TWIN_MOCK=1 fixtures + SSE replay
src/lib/connectors hmac, gateway, policy
src/server/repos/  the only DB access
src/app/           routes; api/* handlers use withApi + parseJson
tests/unit/        vitest; evals/ = live-model evals (not in `check`)
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
