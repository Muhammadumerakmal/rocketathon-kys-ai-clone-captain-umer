import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TraitKey, TraitScore, TraitSource } from "@/contracts";

interface TraitRow {
  trait: TraitKey;
  source: TraitSource;
  score: number;
  sample_count: number;
}

export async function getTraits(sb: SupabaseClient): Promise<{ stated: TraitScore[]; revealed: TraitScore[] }> {
  const { data, error } = await sb.from("decision_traits").select("trait,source,score,sample_count").returns<TraitRow[]>();
  if (error) throw error;
  const all = data.map((r) => ({ trait: r.trait, score: r.score, sampleCount: r.sample_count, source: r.source }));
  return { stated: all.filter((t) => t.source === "stated"), revealed: all.filter((t) => t.source === "revealed") };
}

export async function upsertTraits(sb: SupabaseClient, userId: string, scores: readonly TraitScore[]): Promise<void> {
  if (scores.length === 0) return;
  const { error } = await sb.from("decision_traits").upsert(
    scores.map((s) => ({ user_id: userId, trait: s.trait, source: s.source, score: s.score, sample_count: s.sampleCount })),
    { onConflict: "user_id,trait,source" },
  );
  if (error) throw error;
}

export async function snapshotTraits(sb: SupabaseClient, userId: string, scores: readonly TraitScore[]): Promise<void> {
  const known = scores.filter((s) => s.sampleCount > 0);
  if (known.length === 0) return;
  const { error } = await sb
    .from("trait_snapshots")
    .insert(known.map((s) => ({ user_id: userId, trait: s.trait, source: s.source, score: s.score })));
  if (error) throw error;
}
