# Deploying TwinOS

Two modes:

| Mode | Needs | Use for |
|---|---|---|
| **Demo** (`TWIN_MOCK=1`) | nothing | trying the UI; data resets on restart, no real AI |
| **Real** (`TWIN_MOCK=0`) | Supabase project + OpenAI key | actual accounts, persistence, real twin |

## 1. Supabase (once, ~5 min)

1. [supabase.com](https://supabase.com) → **New project**. Save the database password.
2. **SQL Editor → New query** → paste all of [`supabase/setup.sql`](../supabase/setup.sql) → **Run**.
   It creates every table, the RLS policies, the search/time-travel function and the quiz questions.
   (This exact file is tested against Postgres + pgvector in `tests/db/`.)
3. **Project Settings → API Keys**: copy the Project URL, the **publishable** key and the **secret** key.
4. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (later: your Vercel URL)
   - Redirect URLs: `http://localhost:3000/auth/callback` and `https://<your-app>.vercel.app/auth/callback`
5. Optional but recommended: **Authentication → Emails → SMTP**. Supabase's built-in mailer is rate-limited
   (a few magic-link emails per hour), fine for testing, not for a demo audience.

## 2. Local

```bash
npm install
cp .env.example .env.local      # then fill in the values below
npm run dev                     # http://localhost:3000
```

`.env.local` for real mode:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
OPENAI_API_KEY=sk-...
APPROVAL_HMAC_SECRET=<64 hex chars>   # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CRON_SECRET=<random>
TWIN_MOCK=0
```

Check it: `http://localhost:3000/api/health` → `{"mode":"live","supabaseConfigured":true,"openaiConfigured":true}`.

## 3. Vercel

1. [vercel.com/new](https://vercel.com/new) → import `Muhammadaliakmal/expo-team-hackathon`. Framework: Next.js (auto).
2. **Environment Variables**: add every variable from your `.env.local` (Production + Preview).
   Set `NEXT_PUBLIC_APP_URL` to `https://<your-app>.vercel.app`.
   `NEXT_PUBLIC_*` values are baked in at build time: redeploy after changing them.
3. **Deploy**. Then add the Vercel URL to Supabase's Site URL + Redirect URLs (step 1.4).
4. The weekly cron in `vercel.json` (trait snapshots for drift) authenticates with `CRON_SECRET` automatically.

Node 22+ is required (`package.json#engines`); Vercel picks it up.

## 4. Before a demo

```bash
npm run check        # typecheck + lint + 138 tests (incl. real-Postgres schema tests)
npm run build
npm run eval:smoke   # real-model eval on the Aria persona (~1 min, a few cents)
```

## Costs & limits

- Default models: `gpt-5` (primary) + `gpt-5-mini` (fast); change via `TWIN_MODEL_PRIMARY` / `TWIN_MODEL_FAST`.
- `TWIN_REASONING_EFFORT=low` ≈ 9 s per prediction (5 twin runs + 1 stranger, in parallel). `medium` ≈ 26 s.
- Per-user daily token budget: `TWIN_DAILY_TOKEN_BUDGET` (default 200k). Rate limit: 30 AI requests/min/user.
- Set a monthly spend limit in the OpenAI dashboard.
