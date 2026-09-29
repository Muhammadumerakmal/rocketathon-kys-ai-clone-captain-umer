-- TwinOS v2 · 0002 identity & training: preferences, goals, quiz, Decision DNA (plan §9.3)

create table public.preferences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category    text not null,
  key         text not null,
  value       jsonb not null,
  strength    real not null default 0.5 check (strength between 0 and 1),
  source      text not null default 'manual',
  valid_from  timestamptz not null default now(),
  valid_to    timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index preferences_user on public.preferences (user_id, category, valid_to);
create trigger preferences_updated_at before update on public.preferences
  for each row execute function public.set_updated_at();
select public.enable_owner_rls('public.preferences');

create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (length(title) between 1 and 120),
  description text check (length(description) <= 1000),
  priority    smallint not null default 3 check (priority between 1 and 5),
  status      text not null default 'active' check (status in ('active','paused','done','dropped')),
  horizon     text not null default 'quarter' check (horizon in ('week','quarter','year','life')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index goals_user on public.goals (user_id, status, priority);
create trigger goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();
select public.enable_owner_rls('public.goals');

-- Public question bank: readable by everyone, writable by no client.
create table public.training_questions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  question    text not null,
  category    text not null check (category in ('career','money','health','relationships','learning','lifestyle','other')),
  options     jsonb not null,                -- [{id, label, weights:{trait: -1..1}}]
  is_retest   boolean not null default false, -- re-asked later → Self-Consistency Ceiling
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.training_questions enable row level security;
create policy public_read on public.training_questions for select to anon, authenticated using (true);

create table public.training_answers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.training_questions(id) on delete cascade,
  option_id   text not null,
  attempt     smallint not null default 1 check (attempt in (1, 2)), -- 2 = retest
  answered_at timestamptz not null default now(),
  unique (user_id, question_id, attempt)
);
create index training_answers_user on public.training_answers (user_id);
select public.enable_owner_rls('public.training_answers');

create table public.decision_traits (
  user_id      uuid not null references auth.users(id) on delete cascade,
  trait        text not null,
  source       text not null check (source in ('stated','revealed')),
  score        real not null check (score between 0 and 1),
  sample_count int not null default 0 check (sample_count >= 0),
  updated_at   timestamptz not null default now(),
  primary key (user_id, trait, source)
);
create trigger decision_traits_updated_at before update on public.decision_traits
  for each row execute function public.set_updated_at();
select public.enable_owner_rls('public.decision_traits');

create table public.trait_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  trait       text not null,
  source      text not null check (source in ('stated','revealed')),
  score       real not null check (score between 0 and 1),
  snapshot_at timestamptz not null default now()
);
create index trait_snapshots_user on public.trait_snapshots (user_id, trait, snapshot_at);
select public.enable_owner_rls('public.trait_snapshots', array['select','insert']);
