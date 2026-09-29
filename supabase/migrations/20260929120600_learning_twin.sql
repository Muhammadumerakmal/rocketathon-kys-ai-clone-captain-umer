-- TwinOS · 0007 continuously learning twin (Human AI Twin spec §5–§12, §20–§22)
-- Structured, confidence-scored memories; natural learning from conversation; feedback on
-- answers; relevance-gated retrieval so general questions don't drag in personal memories.

-- ---------------------------------------------------------------------------
-- Memories become structured preferences too: category / key / confidence / evidence.
-- (One table for Train, Ask and feedback — spec §2: never separate preference systems.)
-- ---------------------------------------------------------------------------
alter table public.memories
  add column if not exists category     text not null default 'other'
    check (category in ('coding','career','study','goals','food','travel','communication','work_style','entertainment','health','money','relationships','other')),
  add column if not exists memory_key   text check (memory_key ~ '^[a-z0-9_]{2,60}$'),
  add column if not exists confidence   real not null default 0.6 check (confidence between 0 and 1),
  add column if not exists evidence     text check (length(evidence) <= 500),
  add column if not exists last_used_at timestamptz;

-- new sources: conversation (natural learning), explicit ("remember that…"), training (quiz)
alter table public.memories drop constraint if exists memories_source_type_check;
alter table public.memories add constraint memories_source_type_check
  check (source_type in ('manual','quiz','training','conversation','explicit','feedback','outcome','import','connector'));

-- At most ONE currently-true memory per (user, category, key): a new value supersedes the old.
create unique index if not exists memories_current_key
  on public.memories (user_id, category, memory_key)
  where memory_key is not null and valid_to is null and influence <> 'sealed';

create index if not exists memories_user_category on public.memories (user_id, category) where valid_to is null;

-- ---------------------------------------------------------------------------
-- Conversations: updated_at for ordering; messages keep optional metadata.
-- ---------------------------------------------------------------------------
alter table public.chats add column if not exists updated_at timestamptz not null default now();
create index if not exists chats_user_updated on public.chats (user_id, updated_at desc);

-- chats had select/insert/update/delete policies from enable_owner_rls; keep delete cascading
-- to messages (FK on delete cascade) so "delete conversation" really deletes it.

-- ---------------------------------------------------------------------------
-- Feedback on personalized answers: Exactly / Mostly right / Wrong (+ correction).
-- ---------------------------------------------------------------------------
create table public.message_feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  chat_id         uuid references public.chats(id) on delete cascade,
  answer_excerpt  text not null check (length(answer_excerpt) <= 1000),
  rating          text not null check (rating in ('exactly','mostly','wrong')),
  correction      text check (length(correction) <= 1000),
  memory_ids_used uuid[] not null default '{}',
  created_at      timestamptz not null default now()
);
create index message_feedback_user on public.message_feedback (user_id, created_at desc);
select public.enable_owner_rls('public.message_feedback', array['select','insert']);
-- The generic owner policy checks feedback.user_id. The referenced conversation must
-- also belong to that user; foreign keys alone do not enforce this relationship.
create policy feedback_chat_owner on public.message_feedback as restrictive
  for insert to authenticated
  with check (
    chat_id is null or exists (
      select 1 from public.chats c
      where c.id = chat_id and c.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Retrieval v2: relevance-gated (min_similarity) + confidence/category returned.
-- A general question ("what does useEffect do?") returns NOTHING instead of the
-- nearest-but-irrelevant memories. Keyword hits still count (explicit term overlap).
-- ---------------------------------------------------------------------------
drop function if exists public.match_memories(text, extensions.halfvec, int, timestamptz, int);

create or replace function public.match_memories(
  query_text      text,
  query_embedding extensions.halfvec(1536),
  match_count     int         default 12,
  as_of           timestamptz default now(),
  rrf_k           int         default 50,
  min_similarity  float       default 0.3
) returns table (id uuid, content text, kind text, importance real, valid_from timestamptz,
                 context_qualifier text, category text, memory_key text, confidence real,
                 source_type text, similarity float, score float)
language sql stable security invoker
set search_path = public, extensions
as $$
  with eligible as (
    select m.* from public.memories m
    where m.user_id = (select auth.uid())
      and m.influence = 'active'
      and m.valid_from <= as_of
      -- time-travel is valid-time ("what was true in my life then"), even if recorded later
      and (m.valid_to is null or m.valid_to > as_of)
  ),
  semantic as (
    select e.id,
           1 - (e.embedding <=> query_embedding) as sim,
           row_number() over (order by e.embedding <=> query_embedding) as r
    from eligible e
    where e.embedding is not null and query_embedding is not null
      and 1 - (e.embedding <=> query_embedding) >= min_similarity
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
         m.category, m.memory_key, m.confidence, m.source_type,
         coalesce(s.sim, 0) as similarity,
         coalesce(1.0 / (rrf_k + s.r), 0) + coalesce(1.0 / (rrf_k + k.r), 0) as score
  from semantic s
  full outer join keyword k using (id)
  join eligible m on m.id = coalesce(s.id, k.id)
  order by score desc
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- Confidence moves with evidence (spec §7): only by bounded steps, only on the caller's rows.
-- ---------------------------------------------------------------------------
create or replace function public.adjust_memory_confidence(p_ids uuid[], p_delta real)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n int;
begin
  if p_delta < -0.5 or p_delta > 0.5 then
    raise exception 'delta out of range' using errcode = '22023';
  end if;
  update public.memories
     set confidence = least(1, greatest(0, confidence + p_delta)),
         last_used_at = now()
   where id = any (p_ids) and user_id = (select auth.uid());
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.adjust_memory_confidence(uuid[], real) from public, anon;
grant execute on function public.adjust_memory_confidence(uuid[], real) to authenticated;

-- Close the old value, insert its replacement and link history in one transaction.
-- A failed insert rolls the close back, preserving the current belief.
create or replace function public.replace_learned_memory(
  p_old_id uuid,
  p_content text,
  p_summary text,
  p_kind text,
  p_source_type text,
  p_importance real,
  p_category text,
  p_memory_key text,
  p_confidence real,
  p_evidence text,
  p_embedding extensions.halfvec(1536)
) returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
  closed_at timestamptz := now();
begin
  update public.memories
     set valid_to = closed_at
   where id = p_old_id
     and user_id = (select auth.uid())
     and category = p_category
     and memory_key = p_memory_key
     and influence <> 'sealed'
     and valid_to is null
     and valid_from <= closed_at;
  if not found then
    raise exception 'current memory not found' using errcode = 'P0002';
  end if;

  insert into public.memories (id, user_id, content, summary, kind, source_type,
                              importance, category, memory_key, confidence, evidence,
                              embedding, valid_from)
  values (new_id, (select auth.uid()), p_content, p_summary, p_kind, p_source_type,
          p_importance, p_category, p_memory_key, p_confidence, p_evidence,
          p_embedding, closed_at);

  update public.memories set superseded_by = new_id where id = p_old_id;
  return new_id;
end;
$$;

revoke all on function public.replace_learned_memory(uuid,text,text,text,text,real,text,text,real,text,extensions.halfvec) from public, anon;
grant execute on function public.replace_learned_memory(uuid,text,text,text,text,real,text,text,real,text,extensions.halfvec) to authenticated;
