# Capability Map & Phase Roadmap: TwinOS v2

Source plan (authoritative): `docs/plans/TWINOS_ULTRA_PLAN_v2.md`. The older v1 plans in `docs/plans/0*_*.md` are kept for reference only.

Package manager: **npm**. Repo root: this folder. Node >= 22.

## Deviations from the plan (on purpose)

- **npm instead of pnpm** (`npm run check` = typecheck + lint + test).
- **One developer, one device.** The three-track branches are replaced by small commits on `main`, phase by phase. The folder layout from plan §7 is kept so work can still split across devices later.
- **Mock-first** (plan §16): every AI route honours `TWIN_MOCK=1`, so UI work never waits on keys or the database.
- **shadcn/ui components are hand-written** in `src/components/ui` (same API style) instead of running the shadcn CLI.

## Phases

Each phase ends with `npm run check` green and one or more commits. A phase is done only when its "Done when" line holds.

| Phase | Name | Scope (plan §) | Priority | Done when |
|---|---|---|---|---|
| **0** | Foundation | Next.js scaffold, TS strict, Tailwind v4, env example, AGENTS.md, Zod contracts (§8), pure logic: confidence (§12), ranking/RRF (§9.2), HMAC (§10), mock fixtures (§16), Vitest | P0 · M0 | `npm run check` passes; `npm run dev` renders the shell |
| **1** | Data layer | Supabase migrations: all §9 tables, bi-temporal memories, `match_memories` RPC, RLS (§10), seed training questions, Supabase clients, repos, `proxy.ts` | P0 | migration applies on a clean DB; RLS isolation test passes |
| **2** | Identity | Landing, sign-in (magic link), consent (versioned, Art. 50 copy), app shell + nav, auth guard | P0 | a new user signs in, consents, lands on `/train` |
| **3** | Training | Decision DNA quiz (+ retest questions), deterministic trait scoring, `/api/training` | P0 | answering the quiz writes stated traits |
| **4** | Memory | Ingest pipeline (classify, embed, revise), hybrid retrieval, mute/seal, `/memories` + Belief Revision Inbox | P0 | a contradicting memory shows up in the inbox and "update" closes the old one |
| **5** | Twin chat | Agents SDK twin agent, prompt layers, guardrails, Supabase `Session`, SSE stream, `/twin` + evidence drawer | P0 · M1 | twin answers citing a retrieved memory; sealed memories never reach a prompt |
| **6** | Prediction | k=5 sampling, stranger baseline, confidence, `/api/predict`, feedback → calibration_stats, correction memories | P0 · M2 | predict → mark wrong → calibration and lift change |
| **7** | Duel | "Predict Me" game + live scoreboard | P0 (demo) | 3 rounds update twin-vs-stranger score |
| **8** | Dashboard | Lift, Brier + reliability chart, self-consistency ceiling, blind spots | P1 | dashboard renders from real rows |
| **9** | Depth features | Counterfactual evidence, time-travel `as_of`, Council v2, Simulator v2, outcome check-ins + cron, Twin Passport export/delete | P1 · M3 | each feature reachable from the nav |
| **10** | Connectors & stretch | Calendar via MCP + `needsApproval`/`RunState` + HMAC + audit; drift chart; voice | P2/P3 | approve → event → audit row |
| **11** | Evals & demo | Aria persona seed, eval scorers + adversarial set, Playwright demo path, replay fixtures, demo script | across | held-out accuracy ≥ stranger + 10 pts; 0 leaks |

## Status

| Phase | State | Verified by |
|---|---|---|
| 0 Foundation | ✅ done | `npm run check` (91 tests), `next build` |
| 1 Data layer | ✅ written · ⏳ needs a Supabase project to apply | SQL reviewed; repo mappers unit-tested |
| 2 Identity | ✅ done (mock) · live needs Supabase | prod server smoke test |
| 3 Training | ✅ done | unit tests + API smoke test |
| 4 Memory | ✅ done (mock) · live ingest needs keys | inbox resolve / seal smoke test |
| 5 Twin chat | ✅ done (mock) · live needs keys | SSE smoke test, prompt-safety tests |
| 6–11 | ⏳ in progress | |

## Dependency graph

```
0 foundation ─→ 1 data ─→ 2 identity ─┬─→ 3 training ─┐
                                      ├─→ 4 memory ───┴─→ 5 twin chat ─→ 6 prediction ─┬─→ 7 duel
                                      │                                               ├─→ 8 dashboard
                                      │                                               └─→ 9 depth
                                      └─→ 10 connectors
11 evals: unit tests land with each phase; Aria + E2E after phase 8
```

## Cut rule (plan §3)

F1 stranger baseline, F2 self-consistency, F4 belief revision, F9 duel, F12 sealed/muted + the core loop are the MVP. If time runs short, stop after phase 8.
