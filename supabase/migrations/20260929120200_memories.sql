-- TwinOS v2 · 0003 memories: bi-temporal + hybrid search + belief revision (plan §9.1, §9.2, §11.2)

create table public.memories (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  content           text not null check (length(content) between 1 and 4000),
  summary           text check (length(summary) <= 200),
  kind              text not null check (kind in ('episodic','semantic','procedural','value','goal')),
  source_type       text not null default 'manual'
                    check (source_type in ('manual','quiz','feedback','outcome','import','connector')),
  source_ref        text,
  importance        real not null default 0.5 check (importance between 0 and 1),
  -- "both true in different contexts" resolution (F4)
  context_qualifier text check (length(context_qualifier) <= 200),
  -- bi-temporal
  valid_from        timestamptz not null default now(),   -- became true in the user's life
  valid_to          timestamptz,                          -- null = still true
  recorded_at       timestamptz not null default now(),   -- when TwinOS learned it
  superseded_by     uuid references public.memories(id) on delete set null,
  -- control
  influence         text not null default 'active' check (influence in ('active','muted','sealed')),
  embedding         extensions.halfvec(1536),
  fts               tsvector generated always as (to_tsvector('english', content)) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint memories_valid_window check (valid_to is null or valid_to >= valid_from),
  -- F12 as a database invariant: a sealed memory never has an embedding.
  constraint memories_sealed_no_embedding check (influence <> 'sealed' or embedding is null)
);

create index memories_embedding_hnsw on public.memories
  using hnsw (embedding extensions.halfvec_cosine_ops);
create index memories_fts on public.memories using gin (fts);
create index memories_user_valid on public.memories (user_id, valid_to, influence);

create trigger memories_updated_at before update on public.memories
  for each row execute function public.set_updated_at();
select public.enable_owner_rls('public.memories');

-- Sealing a memory drops its embedding automatically, so the check can never block a seal.
create or replace function public.memories_seal_clears_embedding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.influence = 'sealed' then
    new.embedding = null;
  end if;
  return new;
end;
$$;

create trigger memories_seal before insert or update of influence, embedding on public.memories
  for each row execute function public.memories_seal_clears_embedding();

-- ---------------------------------------------------------------------------
-- Hybrid retrieval with time-travel: vector + full-text fused by RRF.
-- security invoker → RLS applies; the explicit user filter is belt and braces.
-- ---------------------------------------------------------------------------
create or replace function public.match_memories(
  query_text      text,
  query_embedding extensions.halfvec(1536),
  match_count     int         default 12,
  as_of           timestamptz default now(),
  rrf_k           int         default 50
) returns table (id uuid, content text, kind text, importance real,
                 valid_from timestamptz, context_qualifier text, score float)
language sql stable security invoker
set search_path = public, extensions
as $$
  with eligible as (
    select m.* from public.memories m
    where m.user_id = (select auth.uid())
      and m.influence = 'active'
      and m.valid_from <= as_of
      and (m.valid_to is null or m.valid_to > as_of)
      -- time-travel is valid-time ("what was true in my life then"), even if recorded later
  ),
  semantic as (
    select e.id, row_number() over (order by e.embedding <=> query_embedding) as r
    from eligible e
    where e.embedding is not null and query_embedding is not null
    order by e.embedding <=> query_embedding
    limit match_count * 3
  ),
  keyword as (
    select e.id, row_number() over (
             order by ts_rank_cd(e.fts, websearch_to_tsquery('english', query_text)) desc) as r
    from eligible e
    where e.fts @@ websearch_to_tsquery('english', query_text)
    order by ts_rank_cd(e.fts, websearch_to_tsquery('english', query_text)) desc
    limit match_count * 3
  )
  select m.id, m.content, m.kind, m.importance, m.valid_from, m.context_qualifier,
         coalesce(1.0 / (rrf_k + s.r), 0) + coalesce(1.0 / (rrf_k + k.r), 0) as score
  from semantic s
  full outer join keyword k using (id)
  join eligible m on m.id = coalesce(s.id, k.id)
  order by score desc
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- Belief Revision Inbox (F4)
-- ---------------------------------------------------------------------------
create table public.memory_revisions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  new_memory_id   uuid not null references public.memories(id) on delete cascade,
  old_memory_id   uuid not null references public.memories(id) on delete cascade,
  verdict         text not null check (verdict in ('refines','contradicts')),
  explanation     text check (length(explanation) <= 500),
  user_resolution text check (user_resolution in ('update','both_true','old_wrong')),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (new_memory_id, old_memory_id)
);
create index memory_revisions_open on public.memory_revisions (user_id, resolved_at);
select public.enable_owner_rls('public.memory_revisions');
