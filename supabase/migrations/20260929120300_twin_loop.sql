-- TwinOS v2 · 0004 the twin loop: chat, predictions, feedback, calibration, outcomes, duel (plan §9.3, §11)

-- ---------------------------------------------------------------------------
-- Chat (backs the custom Agents SDK Session — history stays under RLS)
-- ---------------------------------------------------------------------------
create table public.chats (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text check (length(title) <= 120),
  created_at timestamptz not null default now()
);
create index chats_user on public.chats (user_id, created_at desc);
select public.enable_owner_rls('public.chats');

create table public.messages (
  id         bigint generated always as identity primary key,  -- monotonic → stable order
  chat_id    uuid not null references public.chats(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null,
  item       jsonb not null,             -- Agents SDK AgentInputItem
  created_at timestamptz not null default now()
);
create index messages_chat on public.messages (chat_id, id);
select public.enable_owner_rls('public.messages', array['select','insert','delete']);

-- Serialized RunState for human-in-the-loop resume. Server-only (secret key): no client
-- policies, so a browser can never read, forge or tamper with a paused run.
create table public.paused_runs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  chat_id           uuid references public.chats(id) on delete cascade,
  serialized_state  text not null,
  pending_approvals jsonb not null default '[]',
  expires_at        timestamptz not null,
  created_at        timestamptz not null default now()
);
alter table public.paused_runs enable row level security;

-- ---------------------------------------------------------------------------
-- Predictions (rule 8: evidence, baseline, distribution, prompt version, model)
-- ---------------------------------------------------------------------------
create table public.predictions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  scenario         text not null check (length(scenario) <= 1000),
  options          jsonb not null,
  category         text not null default 'other'
                   check (category in ('career','money','health','relationships','learning','lifestyle','other')),
  distribution     jsonb not null,
  top_choice       text not null,
  baseline_choice  text not null,
  baseline_agrees  boolean not null,
  evidence         jsonb not null default '[]',
  rationale        jsonb not null default '[]',
  missing_info     jsonb not null default '[]',
  confidence       real not null check (confidence between 0.05 and 0.95),
  confidence_band  text not null check (confidence_band in ('low','medium','high')),
  under_informed   boolean not null default false,
  as_of            timestamptz,
  prompt_version   text not null,
  model            text not null,
  status           text not null default 'open' check (status in ('open','resolved')),
  source           text not null default 'predict' check (source in ('predict','duel')),
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);
create index predictions_user on public.predictions (user_id, status, created_at desc);
select public.enable_owner_rls('public.predictions', array['select','insert','delete']);

create table public.feedback (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  prediction_id    uuid not null unique references public.predictions(id) on delete cascade,
  verdict          text not null check (verdict in ('correct','partial','wrong')),
  actual_choice    text not null,
  note             text check (length(note) <= 1000),
  twin_correct     boolean not null,
  baseline_correct boolean not null,
  created_at       timestamptz not null default now()
);
select public.enable_owner_rls('public.feedback', array['select']);

-- Materialized per user + category for a fast dashboard. Written only by resolve_prediction().
create table public.calibration_stats (
  user_id       uuid not null references auth.users(id) on delete cascade,
  category      text not null,
  n             int  not null default 0,
  hits          int  not null default 0,
  brier_sum     double precision not null default 0,
  baseline_hits int  not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, category)
);
select public.enable_owner_rls('public.calibration_stats', array['select']);

create table public.outcomes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  prediction_id uuid not null unique references public.predictions(id) on delete cascade,
  due_at        timestamptz not null,
  answered_at   timestamptz,
  actual_choice text,
  satisfaction  smallint check (satisfaction between 1 and 5),
  regret        boolean,
  surprise      text check (length(surprise) <= 500),
  created_at    timestamptz not null default now()
);
create index outcomes_due on public.outcomes (user_id, answered_at, due_at);
select public.enable_owner_rls('public.outcomes', array['select','update']);

create table public.duel_rounds (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  prediction_id     uuid references public.predictions(id) on delete set null,
  scenario_id       text not null,
  scenario          jsonb not null,
  user_choice       text not null,
  twin_choice       text not null,
  twin_distribution jsonb not null,
  baseline_choice   text not null,
  revealed_at       timestamptz not null default now()
);
create index duel_rounds_user on public.duel_rounds (user_id, revealed_at desc);
select public.enable_owner_rls('public.duel_rounds', array['select','insert']);

-- ---------------------------------------------------------------------------
-- resolve_prediction: one atomic step for the correction loop (§11.5)
--   feedback row + prediction resolved + calibration upsert + outcome check-in scheduled.
-- security definer, because feedback / calibration_stats have no client write policy
-- (users mustn't be able to fake their own track record). Every statement is therefore
-- re-scoped to auth.uid() by hand, and search_path is pinned (plan §10).
-- "partial" counts as a miss: calibration stays conservative.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_prediction(
  p_prediction_id uuid,
  p_verdict       text,
  p_actual_choice text,
  p_note          text default null
) returns public.feedback
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  pred  public.predictions;
  fb    public.feedback;
  hit   boolean;
  base  boolean;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into pred from public.predictions
   where id = p_prediction_id and user_id = uid
   for update;
  if not found then
    raise exception 'prediction not found' using errcode = 'P0002';
  end if;
  if pred.status = 'resolved' then
    raise exception 'prediction already resolved' using errcode = '23505';
  end if;
  if p_verdict not in ('correct','partial','wrong') then
    raise exception 'bad verdict' using errcode = '22023';
  end if;

  hit  := p_verdict = 'correct';
  base := pred.baseline_choice = p_actual_choice;

  insert into public.feedback (user_id, prediction_id, verdict, actual_choice, note, twin_correct, baseline_correct)
  values (uid, pred.id, p_verdict, p_actual_choice, p_note, hit, base)
  returning * into fb;

  update public.predictions set status = 'resolved', resolved_at = now() where id = pred.id;

  insert into public.calibration_stats as c (user_id, category, n, hits, brier_sum, baseline_hits)
  values (uid, pred.category, 1, hit::int, power(pred.confidence - hit::int, 2), base::int)
  on conflict (user_id, category) do update
     set n             = c.n + 1,
         hits          = c.hits + excluded.hits,
         brier_sum     = c.brier_sum + excluded.brier_sum,
         baseline_hits = c.baseline_hits + excluded.baseline_hits,
         updated_at    = now();

  if pred.source = 'predict' then
    insert into public.outcomes (user_id, prediction_id, due_at)
    values (uid, pred.id, now() + interval '7 days')
    on conflict (prediction_id) do nothing;
  end if;

  return fb;
end;
$$;

revoke all on function public.resolve_prediction(uuid, text, text, text) from public, anon;
grant execute on function public.resolve_prediction(uuid, text, text, text) to authenticated;
