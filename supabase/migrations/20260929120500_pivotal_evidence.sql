-- TwinOS v2 · 0006 counterfactual evidence (F3)
-- predictions has no client UPDATE policy (users mustn't edit confidence before resolving).
-- This narrow definer function can ONLY flip evidence[].pivotal flags on the caller's own row.

create or replace function public.set_pivotal_evidence(p_prediction_id uuid, p_pivotal_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  updated jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.predictions p
     set evidence = (
       select coalesce(jsonb_agg(
                e || jsonb_build_object('pivotal', (e ->> 'id')::uuid = any (p_pivotal_ids))
                order by ord), '[]'::jsonb)
         from jsonb_array_elements(p.evidence) with ordinality as t(e, ord)
     )
   where p.id = p_prediction_id and p.user_id = uid
   returning p.evidence into updated;

  if updated is null then
    raise exception 'prediction not found' using errcode = 'P0002';
  end if;
  return updated;
end;
$$;

revoke all on function public.set_pivotal_evidence(uuid, uuid[]) from public, anon;
grant execute on function public.set_pivotal_evidence(uuid, uuid[]) to authenticated;
