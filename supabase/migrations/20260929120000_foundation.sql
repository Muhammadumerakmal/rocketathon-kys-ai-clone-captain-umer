-- TwinOS v2 · 0001 foundation: extensions, helpers, profiles (plan §9, §10)

create extension if not exists vector with schema extensions;

-- Keeps updated_at honest on every table that has one.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Enables RLS and the four owner-only policies on a user-owned table.
-- `(select auth.uid())` lets Postgres cache the call per statement (faster on large tables).
create or replace function public.enable_owner_rls(tbl regclass, ops text[] default array['select','insert','update','delete'])
returns void
language plpgsql
set search_path = ''
as $$
declare
  op text;
begin
  execute format('alter table %s enable row level security', tbl);
  foreach op in array ops loop
    if op = 'insert' then
      execute format(
        'create policy %I on %s for insert to authenticated with check (user_id = (select auth.uid()))',
        'owner_insert', tbl);
    elsif op = 'update' then
      execute format(
        'create policy %I on %s for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
        'owner_update', tbl);
    else
      execute format(
        'create policy %I on %s for %s to authenticated using (user_id = (select auth.uid()))',
        'owner_' || op, tbl, op);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  display_name         text check (length(display_name) <= 80),
  twin_name            text check (length(twin_name) <= 80),
  onboarding_completed boolean not null default false,
  consent_version      text,            -- null = never consented; mismatch = re-consent
  consented_at         timestamptz,
  eu_user              boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
create policy owner_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy owner_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Create the profile row at sign-up. security definer → pinned search_path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
