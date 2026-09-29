import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Influence, Memory, MemoryCategory, MemoryKind, MemorySource } from "@/contracts";

/** DB row shape (snake_case). Kept private to the repo; callers get contract types. */
export interface MemoryRow {
  id: string;
  user_id: string;
  content: string;
  summary: string | null;
  kind: MemoryKind;
  source_type: MemorySource;
  importance: number;
  context_qualifier: string | null;
  valid_from: string;
  valid_to: string | null;
  recorded_at: string;
  superseded_by: string | null;
  influence: Influence;
  category: MemoryCategory;
  memory_key: string | null;
  confidence: number;
}

const COLUMNS =
  "id,user_id,content,summary,kind,source_type,importance,context_qualifier,valid_from,valid_to,recorded_at,superseded_by,influence,category,memory_key,confidence";

/** Postgres timestamptz → strict ISO with offset (what the contracts expect). */
const iso = (ts: string) => new Date(ts).toISOString();

export function rowToMemory(r: MemoryRow): Memory {
  return {
    id: r.id,
    content: r.context_qualifier ? `${r.content} (${r.context_qualifier})` : r.content,
    summary: r.summary,
    kind: r.kind,
    sourceType: r.source_type,
    importance: r.importance,
    validFrom: iso(r.valid_from),
    validTo: r.valid_to ? iso(r.valid_to) : null,
    recordedAt: iso(r.recorded_at),
    supersededBy: r.superseded_by,
    influence: r.influence,
    category: r.category,
    key: r.memory_key,
    confidence: r.confidence,
  };
}

/** halfvec input format. PostgREST passes the text form straight to Postgres. */
export const toVectorLiteral = (v: readonly number[]) => `[${v.join(",")}]`;

export interface NewMemory {
  content: string;
  summary?: string | null;
  kind: MemoryKind;
  sourceType?: MemorySource;
  sourceRef?: string | null;
  importance?: number;
  influence?: Influence;
  validFrom?: string;
  /** omitted for sealed memories (the DB also enforces this) */
  embedding?: readonly number[] | null;
  category?: MemoryCategory;
  key?: string | null;
  confidence?: number;
  evidence?: string | null;
}

export async function insertMemory(sb: SupabaseClient, userId: string, m: NewMemory): Promise<Memory> {
  const sealed = m.influence === "sealed";
  const { data, error } = await sb
    .from("memories")
    .insert({
      user_id: userId,
      content: m.content,
      summary: m.summary ?? null,
      kind: m.kind,
      source_type: m.sourceType ?? "manual",
      source_ref: m.sourceRef ?? null,
      importance: m.importance ?? 0.5,
      influence: m.influence ?? "active",
      valid_from: m.validFrom ?? new Date().toISOString(),
      embedding: !sealed && m.embedding ? toVectorLiteral(m.embedding) : null,
      category: m.category ?? "other",
      memory_key: m.key ?? null,
      confidence: m.confidence ?? 0.6,
      evidence: m.evidence?.slice(0, 500) ?? null,
    })
    .select(COLUMNS)
    .single<MemoryRow>();
  if (error) throw error;
  return rowToMemory(data);
}

export async function listMemories(
  sb: SupabaseClient,
  { includeHistory = true, limit = 200 }: { includeHistory?: boolean; limit?: number } = {},
): Promise<Memory[]> {
  let q = sb.from("memories").select(COLUMNS).order("valid_from", { ascending: false }).limit(limit);
  if (!includeHistory) q = q.is("valid_to", null);
  const { data, error } = await q.returns<MemoryRow[]>();
  if (error) throw error;
  return data.map(rowToMemory);
}

export async function getMemories(sb: SupabaseClient, ids: readonly string[]): Promise<Memory[]> {
  if (ids.length === 0) return [];
  const { data, error } = await sb.from("memories").select(COLUMNS).in("id", ids).returns<MemoryRow[]>();
  if (error) throw error;
  return data.map(rowToMemory);
}

export async function updateMemory(
  sb: SupabaseClient,
  id: string,
  patch: Partial<Pick<MemoryRow, "content" | "kind" | "importance" | "influence" | "valid_to" | "superseded_by" | "context_qualifier">>,
): Promise<Memory> {
  const { data, error } = await sb.from("memories").update(patch).eq("id", id).select(COLUMNS).single<MemoryRow>();
  if (error) throw error;
  return rowToMemory(data);
}

export async function deleteMemory(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("memories").delete().eq("id", id);
  if (error) throw error;
}

export interface MatchRow {
  id: string;
  content: string;
  kind: MemoryKind;
  importance: number;
  valid_from: string;
  context_qualifier: string | null;
  category: MemoryCategory;
  memory_key: string | null;
  confidence: number;
  source_type: MemorySource;
  similarity: number;
  score: number;
}

/** Hybrid vector + full-text search with time-travel (`match_memories` RPC, plan §9.2). */
export async function matchMemories(
  sb: SupabaseClient,
  {
    queryText,
    embedding,
    asOf,
    limit = 12,
    minSimilarity = 0.3,
  }: { queryText: string; embedding: readonly number[] | null; asOf?: string | null; limit?: number; minSimilarity?: number },
): Promise<MatchRow[]> {
  const { data, error } = await sb.rpc("match_memories", {
    query_text: queryText,
    query_embedding: embedding ? toVectorLiteral(embedding) : null,
    match_count: limit,
    as_of: asOf ?? new Date().toISOString(),
    min_similarity: minSimilarity,
  });
  if (error) throw error;
  return (data ?? []) as MatchRow[];
}

/** The currently-true memory for a (category, key), if any — for conflict resolution. */
export async function findCurrentPreference(sb: SupabaseClient, category: MemoryCategory, key: string) {
  const { data, error } = await sb
    .from("memories")
    .select("id,content,summary,confidence,source_type")
    .eq("category", category)
    .eq("memory_key", key)
    .is("valid_to", null)
    .neq("influence", "sealed")
    .maybeSingle<{ id: string; content: string; summary: string | null; confidence: number; source_type: MemorySource }>();
  if (error) throw error;
  return data;
}

/** Current preference keys so the learner can reuse a stable key for a correction. */
export async function knownPreferenceKeys(sb: SupabaseClient, limit = 60): Promise<string[]> {
  const { data, error } = await sb
    .from("memories")
    .select("category,memory_key")
    .not("memory_key", "is", null)
    .is("valid_to", null)
    .neq("influence", "sealed")
    .limit(limit)
    .returns<{ category: string; memory_key: string }[]>();
  if (error) throw error;
  return [...new Set(data.map((r) => `${r.category}.${r.memory_key}`))];
}

/** Atomically replace a current learned preference and link its history. */
export async function replaceLearnedMemory(
  sb: SupabaseClient,
  oldId: string,
  m: NewMemory & {
    summary: string;
    sourceType: MemorySource;
    importance: number;
    category: MemoryCategory;
    key: string;
    confidence: number;
    evidence: string;
    /** null falls back to full-text retrieval only, like insertMemory. */
    embedding: readonly number[] | null;
  },
): Promise<string> {
  const { data, error } = await sb.rpc("replace_learned_memory", {
    p_old_id: oldId,
    p_content: m.content,
    p_summary: m.summary,
    p_kind: m.kind,
    p_source_type: m.sourceType,
    p_importance: m.importance,
    p_category: m.category,
    p_memory_key: m.key,
    p_confidence: m.confidence,
    p_evidence: m.evidence,
    p_embedding: m.embedding ? toVectorLiteral(m.embedding) : null,
  });
  if (error) throw error;
  return data as string;
}

/** Close a belief (it stops being true now) — history is kept, never deleted. */
export async function closeMemory(sb: SupabaseClient, id: string, supersededBy?: string): Promise<void> {
  const patch: Record<string, string> = { valid_to: new Date().toISOString() };
  if (supersededBy) patch.superseded_by = supersededBy;
  const { error } = await sb.from("memories").update(patch).eq("id", id);
  if (error) throw error;
}

/** Confidence moves in bounded steps (DB fn clamps to 0..1 and scopes to the caller). */
export async function adjustConfidence(sb: SupabaseClient, ids: readonly string[], delta: number): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await sb.rpc("adjust_memory_confidence", { p_ids: ids, p_delta: delta });
  if (error) throw error;
}
