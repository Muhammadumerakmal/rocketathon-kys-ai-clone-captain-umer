import type { DecisionCategory, TraitScore } from "@/contracts";
import { liftPts, reliabilityBins, type ReliabilityBin } from "@/lib/ai/confidence";
import { blindSpots, readiness, type BlindSpot } from "@/lib/training/score";

export interface CategoryRow {
  category: DecisionCategory;
  n: number;
  hits: number;
  brierSum: number;
  baselineHits: number;
}

export interface DashboardData {
  readiness: { known: number; total: number };
  memoryCount: number;
  openRevisions: number;
  resolved: number;
  twinHits: number;
  baselineHits: number;
  twinAccuracy: number | null;
  strangerAccuracy: number | null;
  liftPts: number;
  /** mean (confidence − outcome)²; lower is better; null until anything is resolved */
  brier: number | null;
  reliability: ReliabilityBin[];
  /** the user's own test–retest agreement (Self-Consistency Ceiling) */
  ceiling: number | null;
  /** twin accuracy ÷ ceiling — "how close to your own consistency" */
  relativeToCeiling: number | null;
  stated: TraitScore[];
  revealed: TraitScore[];
  blindSpots: BlindSpot[];
  byCategory: CategoryRow[];
}

export interface DashboardInput {
  stated: readonly TraitScore[];
  revealed: readonly TraitScore[];
  categories: readonly CategoryRow[];
  points: readonly { confidence: number; correct: boolean }[];
  ceiling: number | null;
  memoryCount: number;
  openRevisions: number;
}

/** Pure: every number on the honesty dashboard (plan §11.5, §11.8, §12, F1, F6). */
export function computeDashboard(i: DashboardInput): DashboardData {
  const resolved = i.categories.reduce((a, c) => a + c.n, 0);
  const twinHits = i.categories.reduce((a, c) => a + c.hits, 0);
  const baselineHits = i.categories.reduce((a, c) => a + c.baselineHits, 0);
  const brierSum = i.categories.reduce((a, c) => a + c.brierSum, 0);
  const twinAccuracy = resolved ? twinHits / resolved : null;

  return {
    readiness: readiness([...i.stated]),
    memoryCount: i.memoryCount,
    openRevisions: i.openRevisions,
    resolved,
    twinHits,
    baselineHits,
    twinAccuracy,
    strangerAccuracy: resolved ? baselineHits / resolved : null,
    liftPts: liftPts(twinHits, baselineHits, resolved),
    brier: resolved ? brierSum / resolved : null,
    reliability: reliabilityBins(i.points),
    ceiling: i.ceiling,
    relativeToCeiling: twinAccuracy !== null && i.ceiling ? Math.min(1.5, twinAccuracy / i.ceiling) : null,
    stated: [...i.stated],
    revealed: [...i.revealed],
    blindSpots: blindSpots(i.stated, i.revealed),
    byCategory: [...i.categories].sort((a, b) => b.n - a.n),
  };
}
