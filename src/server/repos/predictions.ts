import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecisionCategory, EvidenceRef, FeedbackVerdict, Prediction } from "@/contracts";

interface PredictionRow {
  id: string;
  scenario: string;
  options: string[];
  category: DecisionCategory;
  distribution: Record<string, number>;
  top_choice: string;
  baseline_choice: string;
  baseline_agrees: boolean;
  evidence: EvidenceRef[];
  rationale: string[];
  missing_info: string[];
  confidence: number;
  confidence_band: Prediction["confidence"]["band"];
  under_informed: boolean;
  as_of: string | null;
  prompt_version: string;
  model: string;
  status: Prediction["status"];
  created_at: string;
}

const COLS =
  "id,scenario,options,category,distribution,top_choice,baseline_choice,baseline_agrees,evidence,rationale,missing_info,confidence,confidence_band,under_informed,as_of,prompt_version,model,status,created_at";

export function rowToPrediction(r: PredictionRow): Prediction {
  return {
    id: r.id,
    scenario: r.scenario,
    options: r.options,
    category: r.category,
    distribution: r.distribution,
    topChoice: r.top_choice,
    baseline: { choice: r.baseline_choice, agreesWithTwin: r.baseline_agrees },
    evidence: r.evidence,
    rationale: r.rationale,
    missingInfo: r.missing_info,
    // Reasons aren't stored; the band + value are. Stored predictions show the number only.
    confidence: { value: r.confidence, band: r.confidence_band, reasons: [] },
    underInformed: r.under_informed,
    asOf: r.as_of ? new Date(r.as_of).toISOString() : null,
    status: r.status,
    promptVersion: r.prompt_version,
    model: r.model,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function insertPrediction(
  sb: SupabaseClient,
  userId: string,
  p: Prediction,
  source: "predict" | "duel" = "predict",
): Promise<void> {
  const { error } = await sb.from("predictions").insert({
    id: p.id,
    user_id: userId,
    scenario: p.scenario,
    options: p.options,
    category: p.category,
    distribution: p.distribution,
    top_choice: p.topChoice,
    baseline_choice: p.baseline.choice,
    baseline_agrees: p.baseline.agreesWithTwin,
    evidence: p.evidence,
    rationale: p.rationale,
    missing_info: p.missingInfo,
    confidence: p.confidence.value,
    confidence_band: p.confidence.band,
    under_informed: p.underInformed,
    as_of: p.asOf,
    prompt_version: p.promptVersion,
    model: p.model,
    source,
  });
  if (error) throw error;
}

export async function getPrediction(sb: SupabaseClient, id: string): Promise<Prediction | null> {
  const { data, error } = await sb.from("predictions").select(COLS).eq("id", id).maybeSingle<PredictionRow>();
  if (error) throw error;
  return data ? rowToPrediction(data) : null;
}

export async function recentPredictions(sb: SupabaseClient, limit = 20): Promise<Prediction[]> {
  const { data, error } = await sb
    .from("predictions")
    .select(COLS)
    .eq("source", "predict")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<PredictionRow[]>();
  if (error) throw error;
  return data.map(rowToPrediction);
}

export interface CategoryStats {
  category: DecisionCategory;
  n: number;
  hits: number;
  brierSum: number;
  baselineHits: number;
}

export async function calibrationStats(sb: SupabaseClient): Promise<CategoryStats[]> {
  const { data, error } = await sb
    .from("calibration_stats")
    .select("category,n,hits,brier_sum,baseline_hits")
    .returns<{ category: DecisionCategory; n: number; hits: number; brier_sum: number; baseline_hits: number }[]>();
  if (error) throw error;
  return data.map((r) => ({ category: r.category, n: r.n, hits: r.hits, brierSum: r.brier_sum, baselineHits: r.baseline_hits }));
}

export async function categoryHistory(sb: SupabaseClient, category: DecisionCategory): Promise<{ n: number; hits: number }> {
  const stats = await calibrationStats(sb);
  const s = stats.find((x) => x.category === category);
  return { n: s?.n ?? 0, hits: s?.hits ?? 0 };
}

/** Atomic correction loop (SQL function resolve_prediction, migration 0004). */
export async function resolvePrediction(
  sb: SupabaseClient,
  r: { predictionId: string; verdict: FeedbackVerdict; actualChoice: string; note?: string },
) {
  const { data, error } = await sb.rpc("resolve_prediction", {
    p_prediction_id: r.predictionId,
    p_verdict: r.verdict,
    p_actual_choice: r.actualChoice,
    p_note: r.note ?? null,
  });
  if (error) throw error;
  return data as { twin_correct: boolean; baseline_correct: boolean };
}

/** Points for the reliability chart: confidence vs whether the twin was right. */
export async function reliabilityPoints(sb: SupabaseClient): Promise<{ confidence: number; correct: boolean }[]> {
  const { data, error } = await sb
    .from("feedback")
    .select("twin_correct, predictions!inner(confidence)")
    .returns<{ twin_correct: boolean; predictions: { confidence: number } }[]>();
  if (error) throw error;
  return data.map((r) => ({ confidence: r.predictions.confidence, correct: r.twin_correct }));
}

/** Resolved decisions in order (confirmed predictions and duel rounds) for the Insights ledger. */
export async function ledgerEntries(sb: SupabaseClient) {
  const { data, error } = await sb
    .from("feedback")
    .select("created_at,twin_correct,baseline_correct,predictions!inner(scenario)")
    .order("created_at", { ascending: true })
    .limit(200)
    .returns<{ created_at: string; twin_correct: boolean; baseline_correct: boolean; predictions: { scenario: string } }[]>();
  if (error) throw error;
  return data.map((r) => ({
    at: new Date(r.created_at).toISOString(),
    scenario: r.predictions.scenario,
    twinCorrect: r.twin_correct,
    baselineCorrect: r.baseline_correct,
  }));
}
