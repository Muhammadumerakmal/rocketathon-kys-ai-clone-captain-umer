# TwinOS

> Team repo: **expo-team-hackathon**

A consent-based digital twin that learns how you make decisions, then **measurably** predicts, explains and stress-tests them. Every prediction is scored against a "stranger" baseline, so the twin has to prove it knows *you*.

> TwinOS is an AI. It represents patterns learned from information you choose to provide. It is not you, and it can be wrong. You make the decisions.

## Quick start

```bash
nvm use 22            # Node >= 22
npm install
cp .env.example .env.local   # TWIN_MOCK=1 works with no keys
npm run dev           # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run check` | typecheck + lint + 138 tests incl. real-Postgres schema tests |
| `npm run db:setup-sql` | regenerate `supabase/setup.sql` from migrations |
| `npm run eval` | live-model evals on the Aria persona (needs keys) |

## Modes

- `TWIN_MOCK=1`: every AI route returns contract-valid fixtures. No keys or database needed.
- `TWIN_REPLAY=1`: replays recorded real outputs for the Aria demo (on-stage fallback).
- Neither: live Supabase + OpenAI.

## Deploy

Step-by-step (Supabase → local → Vercel): **[docs/DEPLOY.md](docs/DEPLOY.md)**. The database is one paste: `supabase/setup.sql`.

## Docs

- Plan: `docs/plans/TWINOS_ULTRA_PLAN_v2.md`
- Phases & status: `CAPABILITY_MAP.md`
- Rules for contributors and coding agents: `AGENTS.md`
