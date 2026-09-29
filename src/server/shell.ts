import "server-only";
import type { Viewer } from "@/lib/auth";
import { mockAnswers, mockState } from "@/lib/mock/store";
import { trainingProgress } from "@/lib/training/progress";
import { QUESTION_BANK } from "@/lib/training/questions";
import { ALL_TRAITS } from "@/lib/training/score";

/** What the app shell needs on every page: orb readiness + the Memories badge. */
export async function loadShell(viewer: Viewer): Promise<{ readiness: number; pendingRevisions: number }> {
  if (viewer.mode === "mock") {
    const p = trainingProgress(QUESTION_BANK, mockAnswers());
    return { readiness: p.readiness.known / p.readiness.total, pendingRevisions: mockState().revisions.length };
  }
  const sb = viewer.supabase;
  const [traits, revisions] = await Promise.all([
    sb.from("decision_traits").select("trait", { count: "exact", head: true }).eq("source", "stated").gt("sample_count", 0),
    sb.from("memory_revisions").select("id", { count: "exact", head: true }).eq("verdict", "contradicts").is("resolved_at", null),
  ]);
  return { readiness: (traits.count ?? 0) / ALL_TRAITS.length, pendingRevisions: revisions.count ?? 0 };
}
