-- TwinOS v2 · 0005 connectors, consent, audit, budget (plan §9.3, §10, §14, §15)

-- Tokens live in Supabase Vault; this row stores only the Vault reference.
create table public.connector_accounts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  provider             text not null,
  external_account_ref text,
  scopes               text[] not null default '{}',
  status               text not null default 'active' check (status in ('active','revoked','error')),
  token_ref            uuid,             -- vault.secrets id, never plaintext
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, provider)
);
create trigger connector_accounts_updated_at before update on public.connector_accounts
  for each row execute function public.set_updated_at();
-- Users can see and disconnect; connecting (token exchange) is server-only.
select public.enable_owner_rls('public.connector_accounts', array['select','delete']);

-- proposed → approved/rejected → executed/failed, or expired. Written server-side only.
create table public.action_proposals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  paused_run_id uuid references public.paused_runs(id) on delete set null,
  connector   text not null,
  action      text not null,
  arguments   jsonb not null,
  args_hash   text not null,
  summary     text not null,
  status      text not null default 'proposed'
              check (status in ('proposed','approved','rejected','executed','failed','expired')),
  result      jsonb,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index action_proposals_user on public.action_proposals (user_id, status, created_at desc);
select public.enable_owner_rls('public.action_proposals', array['select']);

-- Append-only: insert + select, no update/delete policies.
create table public.consent_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  event      text not null check (event in ('grant','revoke','export','delete')),
  scope      text not null,
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index consent_ledger_user on public.consent_ledger (user_id, created_at desc);
select public.enable_owner_rls('public.consent_ledger', array['select','insert']);

create table public.audit_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_user on public.audit_logs (user_id, created_at desc);
select public.enable_owner_rls('public.audit_logs', array['select','insert']);

-- Deletion receipts with no personal content (survive the cascade; server-only).
create table public.deletion_log (
  id           bigint generated always as identity primary key,
  user_id_hash text not null,          -- sha256(user_id), not a foreign key
  rows_deleted jsonb not null,
  deleted_at   timestamptz not null default now()
);
alter table public.deletion_log enable row level security;

-- ---------------------------------------------------------------------------
-- Per-user daily token budget (rule 11). Readable by the owner; only
-- record_usage() can write, and it can only ever add non-negative usage.
-- ---------------------------------------------------------------------------
create table public.usage_budget (
  user_id       uuid not null references auth.users(id) on delete cascade,
  day           date not null default current_date,
  tokens_in     bigint not null default 0 check (tokens_in >= 0),
  tokens_out    bigint not null default 0 check (tokens_out >= 0),
  cost_estimate numeric(10,4) not null default 0,
  primary key (user_id, day)
);
select public.enable_owner_rls('public.usage_budget', array['select']);

create or replace function public.record_usage(p_tokens_in bigint, p_tokens_out bigint, p_cost numeric default 0)
returns public.usage_budget
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  usage public.usage_budget;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_tokens_in < 0 or p_tokens_out < 0 or p_cost < 0 then
    raise exception 'usage must be non-negative' using errcode = '22023';
  end if;
  insert into public.usage_budget as u (user_id, day, tokens_in, tokens_out, cost_estimate)
  values (uid, current_date, p_tokens_in, p_tokens_out, p_cost)
  on conflict (user_id, day) do update
     set tokens_in     = u.tokens_in + excluded.tokens_in,
         tokens_out    = u.tokens_out + excluded.tokens_out,
         cost_estimate = u.cost_estimate + excluded.cost_estimate
  returning * into usage;
  return usage;
end;
$$;

revoke all on function public.record_usage(bigint, bigint, numeric) from public, anon;
grant execute on function public.record_usage(bigint, bigint, numeric) to authenticated;

-- Helpers are internal: never callable through the API.
revoke all on function public.enable_owner_rls(regclass, text[]) from public, anon, authenticated;
