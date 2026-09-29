import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DueCheckin, OutcomeCheckin } from "@/contracts";

interface DueRow {
  id: string;
  prediction_id: string;
  due_at: string;
  predictions: { scenario: string; top_choice: string };
}

export async function dueCheckins(sb: SupabaseClient, now = new Date()): Promise<DueCheckin[]> {
  const { data, error } = await sb
    .from("outcomes")
    .select("id,prediction_id,due_at,predictions!inner(scenario,top_choice)")
    .is("answered_at", null)
    .lte("due_at", now.toISOString())
    .order("due_at")
    .limit(20)
    .returns<DueRow[]>();
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    predictionId: r.prediction_id,
    scenario: r.predictions.scenario,
    topChoice: r.predictions.top_choice,
    dueAt: new Date(r.due_at).toISOString(),
  }));
}

/** Returns the scenario so the caller can store the outcome as a memory. */
export async function answerCheckin(sb: SupabaseClient, c: OutcomeCheckin): Promise<{ scenario: string } | null> {
  const { data, error } = await sb
    .from("outcomes")
    .update({
      answered_at: new Date().toISOString(),
      actual_choice: c.actualChoice,
      satisfaction: c.satisfaction,
      regret: c.regret,
      surprise: c.surprise ?? null,
    })
    .eq("prediction_id", c.predictionId)
    .is("answered_at", null)
    .select("predictions!inner(scenario)")
    .maybeSingle<{ predictions: { scenario: string } }>();
  if (error) throw error;
  return data ? { scenario: data.predictions.scenario } : null;
}

/** Plain-language memory for an outcome — the "Future-Me" regret signal (plan §11.5). */
export function outcomeMemory(scenario: string, c: OutcomeCheckin): string {
  const feeling = c.regret ? "regretted it" : c.satisfaction >= 4 ? "was glad" : "felt mixed";
  return `After choosing "${c.actualChoice}" for "${scenario}", I ${feeling} (satisfaction ${c.satisfaction}/5)${c.surprise ? `. What surprised me: ${c.surprise}` : ""}.`.slice(0, 4000);
}
