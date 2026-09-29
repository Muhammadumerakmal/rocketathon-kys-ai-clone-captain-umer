import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemoryRevision, RevisionResolution } from "@/contracts";
import { rowToMemory, type MemoryRow } from "./memories";

const MEM = "id,user_id,content,summary,kind,source_type,importance,context_qualifier,valid_from,valid_to,recorded_at,superseded_by,influence";

interface RevisionRow {
  id: string;
  verdict: "refines" | "contradicts";
  explanation: string | null;
  user_resolution: RevisionResolution | null;
  created_at: string;
  new_memory: MemoryRow;
  old_memory: MemoryRow;
}

export async function createRevision(
  sb: SupabaseClient,
  userId: string,
  r: { newMemoryId: string; oldMemoryId: string; verdict: "refines" | "contradicts"; explanation: string },
): Promise<void> {
  const { error } = await sb.from("memory_revisions").insert({
    user_id: userId,
    new_memory_id: r.newMemoryId,
    old_memory_id: r.oldMemoryId,
    verdict: r.verdict,
    explanation: r.explanation.slice(0, 500),
  });
  if (error && error.code !== "23505") throw error; // ignore duplicate pairs
}

export async function openRevisions(sb: SupabaseClient): Promise<MemoryRevision[]> {
  const { data, error } = await sb
    .from("memory_revisions")
    .select(
      `id,verdict,explanation,user_resolution,created_at,
       new_memory:memories!memory_revisions_new_memory_id_fkey(${MEM}),
       old_memory:memories!memory_revisions_old_memory_id_fkey(${MEM})`,
    )
    .eq("verdict", "contradicts")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .returns<RevisionRow[]>();
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    newMemory: rowToMemory(r.new_memory),
    oldMemory: rowToMemory(r.old_memory),
    verdict: r.verdict,
    explanation: r.explanation ?? "",
    resolution: r.user_resolution,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

/** Ids of memories involved in an unresolved contradiction (confidence penalty, §12). */
export async function contradictedMemoryIds(sb: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await sb
    .from("memory_revisions")
    .select("new_memory_id,old_memory_id")
    .eq("verdict", "contradicts")
    .is("resolved_at", null)
    .returns<{ new_memory_id: string; old_memory_id: string }[]>();
  if (error) throw error;
  return new Set(data.flatMap((r) => [r.new_memory_id, r.old_memory_id]));
}

export async function getRevision(sb: SupabaseClient, id: string) {
  const { data, error } = await sb
    .from("memory_revisions")
    .select("id,new_memory_id,old_memory_id,resolved_at")
    .eq("id", id)
    .maybeSingle<{ id: string; new_memory_id: string; old_memory_id: string; resolved_at: string | null }>();
  if (error) throw error;
  return data;
}

export async function markResolved(sb: SupabaseClient, id: string, resolution: RevisionResolution): Promise<void> {
  const { error } = await sb
    .from("memory_revisions")
    .update({ user_resolution: resolution, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
