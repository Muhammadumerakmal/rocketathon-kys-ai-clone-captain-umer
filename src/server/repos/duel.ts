import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DuelRound, DuelScenario } from "@/contracts";

interface DuelRow {
  id: string;
  scenario_id: string;
  scenario: DuelScenario;
  user_choice: string;
  twin_choice: string;
  twin_distribution: Record<string, number>;
  baseline_choice: string;
}

export const rowToRound = (r: DuelRow): DuelRound => ({
  id: r.id,
  scenario: r.scenario,
  userChoice: r.user_choice,
  twinChoice: r.twin_choice,
  twinDistribution: r.twin_distribution,
  baselineChoice: r.baseline_choice,
  twinMatched: r.twin_choice === r.user_choice,
  baselineMatched: r.baseline_choice === r.user_choice,
});

export async function listRounds(sb: SupabaseClient): Promise<DuelRound[]> {
  const { data, error } = await sb
    .from("duel_rounds")
    .select("id,scenario_id,scenario,user_choice,twin_choice,twin_distribution,baseline_choice")
    .order("revealed_at", { ascending: false })
    .limit(200)
    .returns<DuelRow[]>();
  if (error) throw error;
  return data.map(rowToRound);
}

export async function insertRound(sb: SupabaseClient, userId: string, r: DuelRound, predictionId: string | null): Promise<void> {
  const { error } = await sb.from("duel_rounds").insert({
    id: r.id,
    user_id: userId,
    prediction_id: predictionId,
    scenario_id: r.scenario.id,
    scenario: r.scenario,
    user_choice: r.userChoice,
    twin_choice: r.twinChoice,
    twin_distribution: r.twinDistribution,
    baseline_choice: r.baselineChoice,
  });
  if (error) throw error;
}
