# TwinOS — Device 2 Plan
## AI Brain, Memory, Database & Prediction Engine

**Branch:** `track/clone-brain`

---

# Mission

Build the part that makes TwinOS actually different from a normal chatbot.

You own:

- Supabase schema/migrations
- RLS
- memory embeddings + retrieval
- AI provider
- prompt orchestration
- clone chat
- prediction
- confidence heuristic
- correction learning loop

This is the highest-risk technical track.

---

# 1. Owned Paths

```text
src/app/api/clone/**
src/app/api/predict/**
src/app/api/memory/**
src/app/api/feedback/**
src/features/memories/**
src/features/clone/**
src/features/predictions/**
src/lib/ai/**
src/lib/supabase/**
supabase/migrations/**
```

Shared contracts may only change through a coordinated contract commit.

---

# 2. First Task — Database

Implement migrations for:

- profiles
- preferences
- goals
- memories
- training_questions
- training_answers
- decision_traits
- chats
- messages
- predictions
- feedback
- action_proposals
- audit_logs

Enable pgvector.

Use `text-embedding-3-small` default 1536 dimensions.

For semantic retrieval use cosine similarity and HNSW.

Use `halfvec(1536)` if supported by the current Supabase project and migration strategy; otherwise `vector(1536)` is acceptable for MVP.

---

# 3. RLS

Every user table must isolate by `auth.uid()`.

Test:
- user A cannot SELECT user B memories
- user A cannot UPDATE user B prediction
- user A cannot insert rows pretending to be B

Do not rely on UI hiding data.

---

# 4. Supabase Utilities

Create:

```text
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/supabase/admin.ts
```

Rules:
- browser client only gets publishable key
- admin client server-only
- service role imports must not be reachable from Client Components

---

# 5. AI Provider Boundary

`src/lib/ai/provider.ts`

The app should read:

```env
OPENAI_MODEL=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

Do not scatter model names through route files.

Expose functions:

```ts
getChatModel()
getEmbeddingModelName()
```

Use Vercel AI SDK for generation and native OpenAI SDK only if required for embedding behavior not covered by your chosen abstraction.

---

# 6. Memory Ingestion

## POST `/api/memory`

Input:

```ts
{
  content: string;
  type?: "fact" | "preference" | "goal" | "experience" | "correction";
  importance?: number;
}
```

Flow:

```text
authenticate
validate Zod
normalize text
generate short summary
create embedding
insert owned memory
return safe DTO
```

Avoid embedding secrets accidentally displayed in logs.

---

# 7. Memory Retrieval

Create:

```ts
retrieveMemories({
  userId,
  query,
  limit,
  threshold
})
```

Algorithm:

1. embed query
2. vector RPC search
3. filter by `user_id` inside SQL/RPC
4. return top relevant memories
5. include similarity score
6. optionally blend importance + recency

Suggested blended score:

```text
0.70 semantic similarity
0.20 importance
0.10 recency
```

Do not let recency overpower relevance.

---

# 8. Prompt Orchestrator

Create:

```text
src/lib/ai/prompts/clone-system.ts
src/lib/ai/prompts/prediction.ts
src/lib/ai/prompts/council-base.ts
src/lib/ai/orchestrator.ts
```

The clone system prompt must state:

- it is a digital model, not literally the person
- use provided evidence
- do not invent personal memories
- acknowledge insufficient context
- distinguish known facts from inference
- user makes final decisions

---

# 9. Clone Chat

## POST `/api/clone`

Use:
- AI SDK `streamText`
- AI SDK UI message stream
- authenticated chat ownership
- relevant-memory retrieval
- preference/goal/trait context

Flow:

```text
validate message
 -> retrieve memory
 -> load profile
 -> bounded prompt context
 -> stream output
 -> persist complete UI messages
```

Limit memory pack size.

Do not dump the entire DB into every prompt.

---

# 10. Prediction Engine

## POST `/api/predict`

Input:

```ts
{
  scenario: string;
  category?: string;
}
```

Use structured output matching shared `ClonePredictionSchema`.

Model returns:
- prediction
- rationale
- evidence candidates / references
- qualitative self-assessment

Application calculates final numeric confidence.

---

# 11. Confidence Heuristic

Implement in:

```text
src/lib/ai/confidence.ts
```

Signals:

```ts
type ConfidenceSignals = {
  retrievalCoverage: number;
  evidenceStrength: number;
  historicalAccuracy: number;
  profileCompleteness: number;
  contradictions: number;
};
```

Formula:

```text
base =
  .35 evidenceStrength +
  .30 retrievalCoverage +
  .20 historicalAccuracy +
  .15 profileCompleteness

confidence = clamp(base - contradictions * .08, .05, .95)
```

Return explanation signals too.

Example:

```json
{
  "score": 0.82,
  "reasons": [
    "4 relevant memories support this prediction",
    "High historical match rate in career decisions"
  ]
}
```

Never market it as calibrated probability.

---

# 12. Training Scoring

Turn quiz answers into decision traits.

Keep transparent rules for MVP.

Example:

```text
safe job -> stability +2
risky startup -> opportunity +2
course vs immediate money -> learning +2
```

Normalize each trait to `0..1`.

Store:
- score
- sample_count
- confidence

Avoid asking an LLM to invent the Decision DNA score if deterministic scoring works.

---

# 13. Feedback Loop

## POST `/api/feedback`

Input:

```ts
{
  predictionId: string;
  verdict: "correct" | "wrong" | "partial";
  actualAnswer?: string;
  correction?: string;
}
```

Flow:

1. ensure prediction belongs to user
2. store verdict
3. store correction
4. create correction memory if meaningful
5. update historical category metrics
6. optionally update preference/trait signals

Never erase historical prediction.

---

# 14. Historical Match Rate

Definition:

```text
correct = 1
partial = 0.5
wrong = 0
```

Calculate by category and globally.

Show only after meaningful samples.

Example:
- fewer than 3 predictions -> UI can show "Not enough data yet"

---

# 15. Security

Must add:

- max input length
- auth checks before queries
- RLS
- rate limiting integration hook
- no secrets in logs
- generic production errors
- server-side validation
- connector tools not available in clone route unless explicitly intended

Treat memory text as untrusted user content.

Retrieved memory must be clearly delimited in prompts and not allowed to override system instructions.

---

# 16. Tests

Unit:
- confidence function
- trait scoring
- context trimming
- evidence mapping

Integration:
- RLS isolation
- vector retrieval belongs to user
- unauthenticated clone returns 401
- invalid prediction payload returns 400
- feedback cannot modify other user's prediction

Smoke:
- memory -> embedding -> retrieval -> chat

---

# 17. Git Routine

```bash
git clone <repo>
# repo root = ai-human-clone-hack-kys
git checkout track/clone-brain
npm install
```

Push small slices:

```text
feat(db): add core clone schema and rls
feat(memory): add embedding ingestion
feat(memory): add semantic retrieval rpc
feat(clone): add grounded streaming route
feat(prediction): add structured prediction
feat(feedback): add correction learning loop
```

Before every push:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

---

# 18. Definition of Done

Device 2 is done when:

- migrations work from clean DB
- RLS blocks cross-user access
- memory insertion generates embedding
- semantic retrieval works
- clone chat streams
- responses use real owned memories
- prediction is structured
- confidence is app-computed
- corrections persist and affect future context
- core path works without connectors
