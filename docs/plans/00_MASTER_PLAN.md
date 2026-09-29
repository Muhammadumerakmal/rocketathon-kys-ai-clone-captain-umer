# TwinOS — Human Digital Clone
## Master Implementation & Parallel Development Plan

**Status:** Hackathon MVP  
**Architecture:** Single Next.js repository, 3 parallel development tracks  
**Verified stack date:** 2026-09-29

---

## 0. Product Definition

**TwinOS** is a consent-based digital human clone that learns a user's:

- memories and knowledge
- preferences
- goals
- decision patterns ("Decision DNA")
- corrections/feedback over time

It can then:

1. chat using the user's personal context,
2. predict how the user may respond to a situation,
3. explain which memories/preferences influenced the prediction,
4. show an evidence-based confidence heuristic,
5. learn from corrections,
6. compare multiple perspectives through "Clone Council",
7. simulate "what-if" scenarios,
8. optionally use external tools/connectors only with explicit user approval.

### Core positioning

> **"Don't just chat with AI. Train AI to understand how you think."**

TwinOS is **decision support**, not a replacement for the human. The user remains the final decision-maker.

---

# 1. Recommended Stack

## Core web stack

- **Next.js 16.3.x Active LTS** with App Router
- **React 19**
- **TypeScript** with strict mode
- **npm**
- **Tailwind CSS**
- **shadcn/ui**
- **Lucide icons**
- **Zod** for all shared schemas and API validation

> On 2026-09-29, Next.js 16.3.6 is the current Active LTS security baseline. A 16.3.7 security release is scheduled for 2026-09-30, so update to the newest patched 16.3.x before final deployment.

## Backend + auth + memory

- **Supabase**
  - Postgres
  - Auth
  - Row Level Security
  - Storage
  - pgvector
- **@supabase/ssr** for cookie-based Next.js auth
- **HNSW cosine vector index** for semantic memory retrieval

## AI layer

- **Vercel AI SDK**
  - `ai`
  - `@ai-sdk/react`
  - `@ai-sdk/openai`
- `useChat()` for UI state and streaming
- `streamText()` for clone chat
- structured outputs + Zod for predictions/scenario results
- AI SDK tools for server-side tools and approval-required tools
- model name controlled through environment variable:
  - `OPENAI_MODEL=...`
- embeddings:
  - `text-embedding-3-small`
  - 1536 dimensions by default

## Connectors

### Recommended MVP connector strategy

**Tier 1 — Core, required**
- Supabase
- OpenAI through Vercel AI SDK

**Tier 2 — Hackathon stretch**
- `@ai-sdk/mcp`
- production MCP transport over HTTP
- Composio for Google Calendar / Gmail style external app connectivity

**Tier 3 — Demo polish**
- OpenAI Realtime API over WebRTC for a voice conversation mode

### Connector safety rule

External write actions must never happen silently.

Pattern:

`AI proposes action -> UI shows exact action -> user approves -> tool executes -> audit log saved`

Examples requiring approval:
- send email
- create/update calendar event
- delete/change external data

Read-only calls can be allowed separately through explicit connected-app permissions.

## Reliability

- **Upstash Redis + @upstash/ratelimit** for AI endpoint rate limiting
- optional Sentry later
- Vercel for deployment

---

# 2. Why This Stack

## Why Next.js App Router

Use one framework for:

- Server Components
- Client Components
- Route Handlers
- auth middleware/proxy boundary
- streamed AI routes
- deployment on Vercel

Do **not** create a separate Express server for the hackathon MVP.

## Why Supabase

One service covers:

- users
- relational data
- RLS authorization
- memories
- vector search
- files
- session-based auth

This prevents maintaining MongoDB + vector DB + auth provider separately.

## Why Vercel AI SDK

It provides a clean Next.js-native abstraction for:

- streaming
- chat state
- tool calls
- provider switching
- human approval flows
- MCP tools

The app should not couple UI components directly to raw OpenAI response formats.

---

# 3. System Architecture

```text
Browser
  |
  | HTTPS
  v
Next.js App Router
  |
  +-- Auth / onboarding
  +-- Clone UI
  +-- Dashboard
  +-- Scenario simulator
  |
  +--> Route Handlers / Server Actions
          |
          +--> Clone Orchestrator
          |      |
          |      +--> Profile / Decision DNA
          |      +--> Memory Retriever
          |      +--> Prompt Builder
          |      +--> Vercel AI SDK -> OpenAI
          |
          +--> Supabase
          |      +--> Auth
          |      +--> Postgres
          |      +--> pgvector
          |      +--> Storage
          |
          +--> Connector Gateway
                 +--> MCP
                 +--> Composio
                 +--> Approval Gate
```

---

# 4. Golden Engineering Rules

1. **Server Components by default.** Add `"use client"` only where interaction requires it.
2. **Never expose service role keys, OpenAI keys, connector secrets, or Supabase admin keys to the browser.**
3. **All incoming API payloads use Zod validation.**
4. **All user-owned DB tables use RLS.**
5. **No direct DB access inside random React components.** Use repository/service functions.
6. **No AI prompt strings scattered across pages.** Keep prompts in `src/lib/ai/prompts/`.
7. **No fabricated confidence percentage from the LLM.** Compute a confidence heuristic in application code from evidence.
8. **Every clone prediction returns evidence references.**
9. **Actions are proposed first and executed only after approval.**
10. **All three developers respect folder ownership until integration day.**
11. **No developer edits another track's owned folder without coordination.**
12. **Run typecheck + lint + tests before every PR/merge.**

---

# 5. Repo Layout

```text
twinos/
├─ src/
│  ├─ app/
│  │  ├─ (marketing)/
│  │  ├─ (auth)/
│  │  ├─ (app)/
│  │  │  ├─ dashboard/
│  │  │  ├─ clone/
│  │  │  ├─ train/
│  │  │  ├─ memories/
│  │  │  ├─ council/
│  │  │  ├─ simulator/
│  │  │  └─ settings/
│  │  └─ api/
│  │     ├─ clone/
│  │     ├─ predict/
│  │     ├─ feedback/
│  │     ├─ memory/
│  │     ├─ council/
│  │     ├─ simulator/
│  │     ├─ connectors/
│  │     └─ realtime/
│  │
│  ├─ components/
│  │  ├─ ui/
│  │  ├─ shell/
│  │  └─ shared/
│  │
│  ├─ features/
│  │  ├─ identity/
│  │  ├─ training/
│  │  ├─ memories/
│  │  ├─ clone/
│  │  ├─ predictions/
│  │  ├─ council/
│  │  ├─ simulator/
│  │  ├─ analytics/
│  │  └─ connectors/
│  │
│  ├─ contracts/
│  │  ├─ clone.ts
│  │  ├─ memory.ts
│  │  ├─ prediction.ts
│  │  ├─ council.ts
│  │  ├─ simulator.ts
│  │  └─ connector.ts
│  │
│  ├─ lib/
│  │  ├─ ai/
│  │  │  ├─ provider.ts
│  │  │  ├─ prompts/
│  │  │  ├─ memory-retriever.ts
│  │  │  ├─ confidence.ts
│  │  │  └─ orchestrator.ts
│  │  ├─ supabase/
│  │  │  ├─ client.ts
│  │  │  ├─ server.ts
│  │  │  └─ admin.ts
│  │  ├─ connectors/
│  │  ├─ security/
│  │  ├─ rate-limit/
│  │  └─ utils/
│  │
│  └─ types/
│
├─ supabase/
│  ├─ migrations/
│  └─ seed.sql
│
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
│
├─ docs/
│  ├─ API_CONTRACTS.md
│  ├─ DB_SCHEMA.md
│  ├─ MERGE_PROTOCOL.md
│  └─ DEMO_SCRIPT.md
│
├─ .env.example
├─ AGENTS.md
└─ README.md
```

---

# 6. Shared Contracts — Freeze Before Parallel Work

Before splitting into 3 devices, create these schemas in a single bootstrap commit.

```ts
// src/contracts/prediction.ts
import { z } from "zod";

export const EvidenceSchema = z.object({
  id: z.string(),
  type: z.enum(["memory", "preference", "goal", "decision", "feedback"]),
  label: z.string(),
  relevance: z.number().min(0).max(1),
});

export const ClonePredictionSchema = z.object({
  prediction: z.string(),
  rationale: z.array(z.string()).max(5),
  evidence: z.array(EvidenceSchema),
  modelSelfAssessment: z.enum(["low", "medium", "high"]),
});

export type ClonePrediction = z.infer<typeof ClonePredictionSchema>;
```

Important: the model does **not** produce the final numeric confidence.

App code computes it.

```ts
export type ConfidenceSignals = {
  retrievalCoverage: number;
  evidenceStrength: number;
  historicalAccuracy: number;
  profileCompleteness: number;
};
```

Suggested heuristic for MVP:

```text
confidence =
  0.35 * evidenceStrength +
  0.30 * retrievalCoverage +
  0.20 * historicalAccuracy +
  0.15 * profileCompleteness
```

Display:

`Clone confidence: 82% (heuristic, based on available evidence)`

Do not present it as a scientifically calibrated probability.

---

# 7. Database Schema

All user-owned tables include `user_id uuid references auth.users(id)`.

## profiles

- `user_id`
- `display_name`
- `clone_name`
- `bio`
- `onboarding_completed`
- timestamps

## preferences

- `id`
- `user_id`
- `category`
- `key`
- `value jsonb`
- `strength float`
- `source`
- timestamps

## goals

- `id`
- `user_id`
- `title`
- `description`
- `priority`
- `status`
- timestamps

## memories

- `id`
- `user_id`
- `content`
- `summary`
- `memory_type`
- `source_type`
- `source_ref`
- `importance`
- `embedding halfvec(1536)` or `vector(1536)`
- timestamps

Create HNSW cosine index.

## training_questions

- `id`
- `slug`
- `question`
- `category`
- `options jsonb`
- `weight`

## training_answers

- `id`
- `user_id`
- `question_id`
- `answer jsonb`
- timestamp

## decision_traits

Examples:

- risk_tolerance
- learning_vs_money
- short_vs_long_term
- independence_vs_team
- stability_vs_opportunity
- speed_vs_perfection

Columns:

- `user_id`
- `trait`
- `score`
- `sample_count`
- `confidence`
- timestamps

## chats

- `id`
- `user_id`
- `title`
- timestamps

## messages

- `id`
- `chat_id`
- `user_id`
- `role`
- `parts jsonb`
- timestamp

Store AI SDK UI-message compatible structures where practical.

## predictions

- `id`
- `user_id`
- `scenario`
- `prediction jsonb`
- `confidence`
- `actual_answer`
- `matched`
- timestamps

## feedback

- `id`
- `user_id`
- `prediction_id`
- `feedback_type`
- `correction`
- timestamp

## connector_accounts

- `id`
- `user_id`
- `provider`
- `external_account_ref`
- `status`
- timestamps

Never store external OAuth secrets in plaintext.

## action_proposals

- `id`
- `user_id`
- `connector`
- `action`
- `arguments jsonb`
- `status`: proposed / approved / rejected / executed / failed
- `result jsonb`
- timestamps

## audit_logs

- `id`
- `user_id`
- `event_type`
- `metadata jsonb`
- timestamp

---

# 8. RLS Requirements

For every user-owned table:

- SELECT only when `auth.uid() = user_id`
- INSERT only when `auth.uid() = user_id`
- UPDATE only when `auth.uid() = user_id`
- DELETE only when `auth.uid() = user_id`

Service-role operations:
- server-only
- minimal
- documented
- never exposed to browser

---

# 9. Core AI Flows

## 9.1 Clone Chat

```text
message
 -> authenticate
 -> rate limit
 -> embed query
 -> retrieve top relevant memories
 -> fetch Decision DNA + goals + preferences
 -> build bounded context
 -> stream model response
 -> persist chat
```

Prompt layers:

1. **System identity**
2. **Safety + non-impersonation rules**
3. **User profile**
4. **Decision DNA**
5. **Retrieved memories**
6. **Current user message**

The clone should say "Based on what I know..." rather than pretending it literally is the human.

## 9.2 Memory Ingestion

```text
user enters/imports memory
 -> validate ownership/content
 -> normalize
 -> summarize
 -> generate embedding
 -> store memory + embedding
```

MVP input:
- typed text
- paste notes

Stretch:
- PDF/file upload via Supabase Storage
- chunk + embed

## 9.3 Prediction

Input:

```json
{
  "scenario": "I have a paid safe job and an unpaid dream-field internship."
}
```

Process:

```text
retrieve related memories
 + preferences
 + Decision DNA
 -> structured model output
 -> app confidence heuristic
 -> save prediction
```

Output:

- prediction
- short rationale
- supporting evidence
- confidence
- "Is this what you would choose?" feedback UI

## 9.4 Correction Loop

```text
prediction
 -> user says correct / wrong / partially correct
 -> record actual choice
 -> update historical accuracy
 -> derive/update preference signal
 -> future retrieval includes correction
```

Never silently overwrite old memories. Save the correction as a new event and mark stale signals if needed.

## 9.5 Clone Council

Council is not multiple expensive independent agent frameworks.

MVP:

- Student Me
- Career Me
- Financial Me
- Future Me

Each perspective receives:
- same scenario
- same factual memory pack
- different evaluation lens

Then a synthesis stage creates:
- areas of agreement
- disagreements/trade-offs
- questions the human should consider

Do **not** let the synthesis pretend to make the final choice for the user.

## 9.6 What-If Simulator

Return structured comparison:

```ts
{
  optionA: {
    label: string,
    possibleUpsides: string[],
    possibleTradeoffs: string[],
    goalAlignment: number
  },
  optionB: { ... },
  unknowns: string[]
}
```

Call it a **scenario simulation**, not future prediction.

---

# 10. Three-Device Parallel Development Strategy

## Branches

```text
main
├─ track/ui-identity
├─ track/clone-brain
└─ track/simulation-connectors
```

Optional integration branch:

```text
integration
```

## Device ownership

### Device 1 — UI / Identity / Training
Owns:
- `src/app/(marketing)`
- `src/app/(auth)`
- `src/app/(app)/dashboard`
- `src/app/(app)/train`
- `src/components`
- `src/features/identity`
- `src/features/training`
- `src/features/analytics` UI
- theme/layout

Must NOT edit:
- core AI orchestrator
- migrations after shared bootstrap
- connector execution layer

### Device 2 — AI Brain / Memory / Data
Owns:
- `src/app/api/clone`
- `src/app/api/predict`
- `src/app/api/memory`
- `src/app/api/feedback`
- `src/features/memories`
- `src/features/clone`
- `src/features/predictions`
- `src/lib/ai`
- `src/lib/supabase`
- `supabase/migrations`

This track defines the real data behavior.

### Device 3 — Council / Simulator / Connectors / QA
Owns:
- `src/app/(app)/council`
- `src/app/(app)/simulator`
- `src/app/(app)/settings/connections`
- `src/app/api/council`
- `src/app/api/simulator`
- `src/app/api/connectors`
- `src/features/council`
- `src/features/simulator`
- `src/features/connectors`
- `src/lib/connectors`
- integration/e2e tests

## Shared files

Only modify with coordination:

- `package.json`
- package-lock.json
- `.env.example`
- `src/contracts/*`
- root layout
- `supabase/migrations/*`
- global styles

Rule:
**Shared contract changes require a small dedicated commit and message to all three tracks before dependent code is merged.**

---

# 11. Bootstrap Commit — Do This First on ONE Device

```bash
npx create-next-app@latest . \
  --ts \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

# repo root = ai-human-clone-hack-kys

npm install \
  zod \
  @supabase/supabase-js \
  @supabase/ssr \
  ai \
  @ai-sdk/react \
  @ai-sdk/openai \
  lucide-react \
  clsx \
  tailwind-merge

npm install -D \
  vitest \
  @testing-library/react \
  @testing-library/jest-dom \
  playwright
```

Add shadcn/ui using its current CLI.

Optional after core works:

```bash
npm install @upstash/redis @upstash/ratelimit
npm install @ai-sdk/mcp @modelcontextprotocol/sdk
```

Commit:

```bash
git add .
git commit -m "chore: bootstrap TwinOS architecture and contracts"
git push origin main
```

Create branches:

```bash
git checkout -b track/ui-identity
git push -u origin track/ui-identity

git checkout main
git checkout -b track/clone-brain
git push -u origin track/clone-brain

git checkout main
git checkout -b track/simulation-connectors
git push -u origin track/simulation-connectors
```

Each device clones and checks out **only its assigned branch**.

---

# 12. Environment Variables

`.env.example`

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Optional connector layer
COMPOSIO_API_KEY=

# Optional voice
OPENAI_REALTIME_MODEL=
```

Rules:
- commit `.env.example`
- never commit `.env.local`
- each device gets its own `.env.local`
- use a shared Supabase dev project for hackathon only if migrations are coordinated
- preferably use branch-specific seed users

---

# 13. Implementation Milestones

## M0 — Contracts + shell
Required before split:
- repo bootstrap
- route conventions
- contracts
- auth client utilities
- env example
- base design tokens

## M1 — Working vertical slice
Must demonstrate:
- sign in
- training answers
- save memory
- ask clone
- response uses retrieved memory

## M2 — Killer feature
- prediction
- evidence
- confidence heuristic
- correct/wrong feedback
- accuracy history

## M3 — Wow features
- Clone Council
- What-If Simulator
- dashboard charts
- memory timeline

## M4 — Connectors
Only if M1-M3 are stable:
- read-only Google Calendar example
- proposed write action
- approval dialog
- execute after approval
- audit log

## M5 — Voice
Only if time remains:
- Realtime API
- WebRTC
- server-created short-lived session authorization
- no permanent API key in browser

---

# 14. UI Pages

## `/`
Landing:
- headline
- short product explanation
- interactive demo preview
- CTA: "Create My Clone"

## `/train`
Gamified Decision DNA onboarding:
- progress
- one question/card
- keyboard shortcuts
- categories
- completion summary

## `/dashboard`
Cards:
- Clone Readiness
- Memories
- Decisions Learned
- Historical Match Rate
- Strongest learned dimensions
- Recent corrections

Use "readiness" rather than falsely claiming the human is "82% cloned".

## `/clone`
Chat:
- streaming
- memory/evidence drawer
- "why this answer?"
- new chat
- feedback

## `/memories`
- create
- search
- timeline
- source labels
- delete/edit controls

## `/council`
4 perspective cards + synthesis.

## `/simulator`
2-option scenario comparison.

## `/settings/connections`
connected apps, scopes, disconnect, approval preferences.

---

# 15. Confidence Design

Never ask the model:
> "Give confidence 0-100."

Instead compute from application signals.

Example:

- retrieval returned useful evidence? 0-1
- number and strength of supporting preference signals
- previous accuracy in this category
- profile completeness
- contradiction penalty

Pseudo:

```ts
const raw =
  0.35 * evidenceStrength +
  0.30 * retrievalCoverage +
  0.20 * historicalAccuracy +
  0.15 * profileCompleteness;

const contradictionPenalty = contradictions * 0.08;

return clamp(raw - contradictionPenalty, 0.05, 0.95);
```

UI must explain:
- "High because 4 relevant memories support this."
- "Low because I have little information about your financial preferences."

This is more credible than decorative AI confidence.

---

# 16. Privacy & Consent

Human clone projects are sensitive by nature.

MVP requirements:

- explicit onboarding consent
- clear data deletion
- memory editing/deletion
- source labels
- no hidden scraping
- no voice cloning of another person
- no silent action execution
- per-connector permission display
- audit log of external actions
- user can disable a memory from influencing clone behavior

Recommended wording:
> "TwinOS represents patterns learned from information you choose to provide. It is not literally you and may be wrong."

---

# 17. Connector Architecture

Define a common interface.

```ts
export interface ConnectorAdapter {
  id: string;
  capabilities: ("read" | "propose-write" | "execute-write")[];

  listTools(): Promise<ConnectorTool[]>;

  executeRead(
    userId: string,
    tool: string,
    args: unknown
  ): Promise<unknown>;

  proposeWrite(
    userId: string,
    tool: string,
    args: unknown
  ): Promise<ActionProposal>;

  executeApproved(
    proposalId: string
  ): Promise<ActionResult>;
}
```

The AI never receives direct unrestricted connector credentials.

For MCP:
- use Streamable HTTP in production
- close clients after use
- whitelist exposed tools for hackathon
- do not dynamically expose thousands of tools to every prompt

For Composio:
- start with one connector: Google Calendar
- optionally Gmail read/search later
- do not add 10 integrations just to show logos

Best demo:
1. clone says user appears busy tomorrow,
2. it reads calendar availability,
3. proposes a new focus block,
4. user presses Approve,
5. event is created,
6. audit log shows it.

---

# 18. API Contract Summary

## POST `/api/memory`
Create user memory.

## GET `/api/memory/search?q=...`
Search owned memory.

## POST `/api/clone`
AI SDK streaming endpoint.

## POST `/api/predict`
Structured clone prediction.

## POST `/api/feedback`
Record correction / actual answer.

## POST `/api/council`
Generate perspective analyses.

## POST `/api/simulator`
Compare options.

## POST `/api/connectors/propose`
Create external action proposal.

## POST `/api/connectors/execute`
Requires approved proposal belonging to current user.

## POST `/api/realtime/session`
Server-only voice session setup.

---

# 19. Tests

## Unit

- confidence heuristic
- prompt context trimming
- decision trait scoring
- Zod parsers
- connector approval state machine

## Integration

- auth required on private APIs
- cannot query another user's memories
- prediction saves evidence
- feedback updates historical metrics
- rejected action cannot execute

## E2E

Critical demo path:

```text
sign in
 -> answer 5 training questions
 -> add 2 memories
 -> ask clone
 -> create prediction
 -> mark correct/wrong
 -> open dashboard
 -> open council
 -> run simulator
```

Connector test:

```text
propose action
 -> no execution before approval
 -> approve
 -> execute
 -> audit row exists
```

---

# 20. Merge Protocol

## Every track before PR

```bash
git fetch origin
git rebase origin/main
npm install
npm run typecheck
npm run lint
npm run test
npm run build
```

If no `typecheck` script exists, add once in bootstrap:

```json
"typecheck": "tsc --noEmit"
```

## PR order

1. **Track 2 / clone-brain first** if it contains migrations/contracts required by others.
2. **Track 1 / UI** second.
3. **Track 3 / simulator-connectors** third.
4. run full E2E.
5. tag demo release.

Do not merge three large branches blindly at the final hour.

Merge small completed slices throughout the hackathon.

Preferred commit format:

```text
feat(training): add decision dna quiz
feat(memory): add pgvector retrieval
feat(clone): stream grounded clone responses
feat(prediction): add evidence-based prediction
feat(council): add multi-perspective analysis
feat(connectors): add approval-gated calendar action
fix(auth): refresh supabase session correctly
test(security): verify cross-user memory isolation
```

---

# 21. Definition of Done

## MVP must work without connectors

A successful MVP is:

- user can authenticate
- user can train Decision DNA
- user can add memory
- clone retrieves relevant memory
- clone responds in context
- prediction gives evidence
- app computes confidence
- user can correct prediction
- dashboard reflects learning

## Hackathon-ready

Add:
- Council
- Simulator
- polished animations
- seeded demo profile
- deterministic fallback demo scenario
- connector proposal + approval if stable

---

# 22. Demo Script

### 1. Hook
"Normal AI knows the world. TwinOS learns *you*."

### 2. Train
Answer 3 fast Decision DNA questions.

### 3. Memory
Show 2-3 saved facts/goals.

### 4. Clone
Ask:
> "I have an exam soon and a hackathon deadline. What would I probably prioritize?"

Show:
- prediction
- evidence
- confidence explanation

### 5. Learn
Mark prediction wrong and give actual preference.

Then ask a similar scenario and show adjusted reasoning.

### 6. Council
Show Student Me, Career Me, Financial Me, Future Me.

### 7. Connector stretch
"Block 45 minutes tomorrow for preparation."

TwinOS must first show:
> Proposed calendar action — Approve / Reject

Approve on stage only if connector is reliable.

### Final line
"Your AI should not only know more. It should understand *you* better — while keeping you in control."

---

# 23. What NOT To Build During MVP

Do not spend core hackathon time on:

- custom LLM training
- a separate Python microservice
- complex agent graphs
- face deepfake generation
- realistic impersonation
- custom vector database
- 10 external integrations
- autonomous email sending
- blockchain
- native mobile app

Finish the intelligence loop first.

---

# 24. Current Ecosystem Notes

Verified against current documentation on 2026-09-29:

- Next.js 16.3.x is Active LTS; a security patch 16.3.7 is scheduled for 2026-09-30.
- Next.js App Router Route Handlers are the current native API route pattern.
- Supabase provides a Next.js App Router quickstart with cookie-based Auth and TypeScript.
- `@supabase/ssr` is recommended for SSR, though its API is documented as beta/subject to change.
- Supabase pgvector supports HNSW cosine indexes; `halfvec(1536)` is a current pattern for OpenAI `text-embedding-3-small`.
- OpenAI `text-embedding-3-small` defaults to 1536 dimensions.
- Vercel AI SDK supports `useChat`, `streamText`, tools, MCP, and approval-gated human-in-the-loop actions.
- OpenAI Realtime supports browser voice using WebRTC with server-mediated session setup.
- Upstash rate limiting is designed for serverless/Next.js environments.

---

# 25. Recommended Priority

If the team gets stuck, use this exact priority:

```text
P0 Auth + DB
P0 Training
P0 Memory RAG
P0 Clone Chat
P0 Prediction + Evidence
P0 Correction Loop
P1 Dashboard
P1 Clone Council
P1 Simulator
P2 Connector
P2 Voice
P3 Fancy animations
```

A beautiful clone that does not learn is weaker than a plain clone with a working learning loop.
