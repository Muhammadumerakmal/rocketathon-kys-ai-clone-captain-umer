# TwinOS — Device 1 Plan
## UI, Identity, Training & Dashboard

**Branch:** `track/ui-identity`

---

# Mission

Build the entire user-facing shell and make TwinOS feel like a premium product.

You own:

- landing
- auth screens
- onboarding
- Decision DNA quiz
- dashboard
- visual system
- shared presentation components

Do not build core AI logic here.

---

# 1. Owned Paths

```text
src/app/(marketing)/**
src/app/(auth)/**
src/app/(app)/dashboard/**
src/app/(app)/train/**
src/components/**
src/features/identity/**
src/features/training/**
src/features/analytics/**
```

Coordinate before editing:
- `src/contracts/**`
- `package.json`
- root layout
- global CSS

---

# 2. Deliverables

## A. Design system

Build:
- dark/light-ready tokens
- glass/soft cards
- responsive sidebar
- top nav
- mobile nav
- loading skeletons
- empty states
- error states
- toast system

Use shadcn primitives rather than custom rebuilding everything.

## B. Landing page

Sections:
- hero
- "How TwinOS learns you"
- Decision DNA
- Memory
- Clone Match
- Council
- privacy/control
- CTA

## C. Authentication UI

Pages:
- sign in
- sign up
- callback/error state

Use shared Supabase utilities created in bootstrap/data track.

No raw auth logic duplicated in components.

## D. Decision DNA onboarding

Question categories:
- risk tolerance
- money vs learning
- short-term vs long-term
- independence vs teamwork
- stability vs opportunity
- speed vs perfection

UX:
- one question per card
- progress bar
- keyboard shortcuts
- smooth transition
- back button
- save state
- completion summary

Do not hardcode 100 questions.
Use seed dataset from DB/API.

## E. Dashboard

Cards:
- Clone Readiness
- Memories saved
- Predictions answered
- Historical Match Rate
- Decision dimensions
- Recent corrections

Charts must be honest:
- "Historical Match Rate", not "AI accuracy of your mind"
- "Clone Readiness", not "Percent cloned"

## F. Evidence components

Create reusable:
- `<EvidenceChip />`
- `<ConfidenceMeter />`
- `<WhyThisAnswer />`
- `<MemorySourceBadge />`
- `<ApprovalCard />`

These will be consumed by the other tracks.

---

# 3. Mock-first Strategy

Until Device 2 API is merged, use fixtures:

```text
src/features/training/__fixtures__/
src/features/analytics/__fixtures__/
```

Never change API contracts just to fit temporary mock data.

Mock the agreed contract shape exactly.

---

# 4. Required Screens

```text
/
/login
/signup
/train
/dashboard
```

Add skeleton navigation links for:
- `/clone`
- `/memories`
- `/council`
- `/simulator`
- `/settings/connections`

Other tracks will fill those.

---

# 5. Suggested Components

```text
components/
  shell/
    app-sidebar.tsx
    app-header.tsx
    mobile-nav.tsx

  shared/
    clone-avatar.tsx
    confidence-meter.tsx
    evidence-chip.tsx
    why-this-answer.tsx
    stat-card.tsx
    decision-trait-bar.tsx
    clone-readiness-ring.tsx
    approval-card.tsx
```

Keep UI components presentation-focused.

No Supabase query inside `ConfidenceMeter`.

---

# 6. Training API Contract

Expected request:

```ts
{
  answers: Array<{
    questionId: string;
    value: string | number | string[];
  }>
}
```

Expected response:

```ts
{
  completed: boolean;
  dimensions: Array<{
    trait: string;
    score: number;
    confidence: number;
  }>;
}
```

Device 2 owns persistence/scoring implementation.

---

# 7. Dashboard API Contract

Expected:

```ts
{
  readiness: number;
  memoryCount: number;
  predictionCount: number;
  historicalMatchRate: number | null;
  traits: Array<{
    trait: string;
    score: number;
    confidence: number;
  }>;
  recentCorrections: Array<{
    id: string;
    scenario: string;
    createdAt: string;
  }>;
}
```

---

# 8. UI Quality Checklist

- no layout shift during streaming states
- keyboard navigable
- focus-visible styles
- meaningful button labels
- mobile layout tested
- empty states look intentional
- error state has retry
- no raw JSON shown to users
- long evidence text truncates gracefully
- animation never blocks interaction

---

# 9. Git Routine

Start:

```bash
git clone <repo>
# repo root = ai-human-clone-hack-kys
git checkout track/ui-identity
npm install
cp .env.example .env.local
```

Before push:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
git add .
git commit -m "feat(ui): ..."
git push
```

---

# 10. Definition of Done

Device 1 is done when:

- landing feels presentation-ready
- auth screens work against shared auth utilities
- training UI writes correct payload
- dashboard renders live API response
- reusable evidence/confidence components are exported
- mobile + desktop work
- no ownership boundaries are violated
