import type { Confidence, ConfidenceBand, ConfidenceSignals } from "@/contracts";

/**
 * Confidence & calibration (plan §12).
 * Rule 7: the model never outputs the final confidence number — this module does.
 */

export const CONFIDENCE_MIN = 0.05;
export const CONFIDENCE_MAX = 0.95;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Vote share per option across k samples. Options with no votes get 0. */
export function voteDistribution(
  choices: readonly string[],
  options: readonly string[],
): Record<string, number> {
  const dist: Record<string, number> = Object.fromEntries(options.map((o) => [o, 0]));
  const valid = choices.filter((c) => c in dist);
  if (valid.length === 0) return dist;
  for (const c of valid) dist[c] = (dist[c] ?? 0) + 1 / valid.length;
  return dist;
}

/**
 * Top choice of a distribution. Ties break by option order, which is stable
 * and user-visible, rather than by whichever sample happened to finish first.
 */
export function topChoice(dist: Record<string, number>, options: readonly string[]): string {
  let best = options[0] ?? "";
  for (const o of options) if ((dist[o] ?? 0) > (dist[best] ?? 0)) best = o;
  return best;
}

/** S: vote share of the top choice. */
export function selfConsistency(dist: Record<string, number>): number {
  return Math.max(0, ...Object.values(dist));
}

export interface EvidenceInput {
  /** relevance (0..1) of each evidence item the samples actually cited */
  citedRelevances: readonly number[];
  /** how many items were retrieved and offered to the model */
  retrievedCount: number;
  /** active, unresolved contradictions touching cited memories */
  contradictions: number;
}

/**
 * E: mean relevance of cited evidence × coverage (cited / retrieved),
 * minus 0.1 per unresolved contradiction. Coverage is capped at 3 cited
 * items so a twin citing 3 strong memories out of 12 isn't punished.
 */
export function evidenceStrength({ citedRelevances, retrievedCount, contradictions }: EvidenceInput): number {
  if (citedRelevances.length === 0 || retrievedCount === 0) return 0;
  const mean = citedRelevances.reduce((a, b) => a + b, 0) / citedRelevances.length;
  const coverage = Math.min(1, citedRelevances.length / Math.min(3, retrievedCount));
  return clamp(mean * coverage - 0.1 * contradictions, 0, 1);
}

/** H: Beta(2,2)-prior posterior mean of the hit rate in this category. */
export function betaPosteriorMean(hits: number, n: number): number {
  return (hits + 2) / (n + 4);
}

/** Combine S, E, H and shrink toward 0.5 when resolved history is thin. */
export function twinConfidence({ S, E, H, n }: ConfidenceSignals): number {
  const raw = 0.45 * S + 0.3 * E + 0.25 * H;
  const w = n / (n + 8);
  const shrunk = w * raw + (1 - w) * (0.5 + 0.5 * (raw - 0.5));
  return clamp(shrunk, CONFIDENCE_MIN, CONFIDENCE_MAX);
}

export function confidenceBand(value: number): ConfidenceBand {
  if (value < 0.45) return "low";
  if (value < 0.7) return "medium";
  return "high";
}

/**
 * Collapsed-variance guard (§11.4): all k samples agree, but the evidence
 * behind them is thin. Shown as "confident but under-informed".
 */
export function isUnderInformed(S: number, E: number): boolean {
  return S >= 0.999 && E < 0.35;
}

export interface ExplainInput extends ConfidenceSignals {
  k: number;
  strongEvidence: number;
  hits: number;
  categoryLabel: string;
}

/** Human-readable reasons, e.g. "3 of 5 runs agreed". Max 3 (contract). */
export function explainConfidence(i: ExplainInput): string[] {
  const agreed = Math.round(i.S * i.k);
  const reasons = [`${agreed} of ${i.k} runs agreed`];
  reasons.push(
    i.strongEvidence > 0
      ? `${i.strongEvidence} strong ${i.strongEvidence === 1 ? "memory supports" : "memories support"} it`
      : "no strong memories on this yet",
  );
  reasons.push(
    i.n > 0
      ? `right ${i.hits}/${i.n} times on ${i.categoryLabel} decisions`
      : `no resolved ${i.categoryLabel} decisions yet`,
  );
  return reasons;
}

export function buildConfidence(i: ExplainInput): Confidence {
  const value = twinConfidence(i);
  return { value, band: confidenceBand(value), reasons: explainConfidence(i) };
}

// ---------- Calibration ----------

/** Brier score for one resolved prediction: (confidence − outcome)². */
export function brier(confidence: number, correct: boolean): number {
  return (confidence - (correct ? 1 : 0)) ** 2;
}

export interface ReliabilityBin {
  lo: number;
  hi: number;
  count: number;
  meanConfidence: number;
  hitRate: number;
}

/** Equal-width reliability bins over [0,1] for the dashboard chart. */
export function reliabilityBins(
  points: readonly { confidence: number; correct: boolean }[],
  bins = 5,
): ReliabilityBin[] {
  return Array.from({ length: bins }, (_, b) => {
    const lo = b / bins;
    const hi = (b + 1) / bins;
    const inBin = points.filter((p) => p.confidence >= lo && (p.confidence < hi || (b === bins - 1 && p.confidence <= hi)));
    const count = inBin.length;
    return {
      lo,
      hi,
      count,
      meanConfidence: count ? inBin.reduce((a, p) => a + p.confidence, 0) / count : 0,
      hitRate: count ? inBin.filter((p) => p.correct).length / count : 0,
    };
  });
}

/**
 * Histogram-binning recalibration (§12): once a user has ≥ 20 resolved
 * predictions, replace raw confidence with the observed hit rate of its bin
 * (only for bins with ≥ 3 points; otherwise keep the raw value).
 */
export function recalibrate(value: number, bins: readonly ReliabilityBin[], resolved: number): number {
  if (resolved < 20) return value;
  const bin = bins.find((b) => value >= b.lo && value < b.hi) ?? bins.at(-1);
  if (!bin || bin.count < 3) return value;
  return clamp(bin.hitRate, CONFIDENCE_MIN, CONFIDENCE_MAX);
}

/** Personalization Lift in percentage points (F1). */
export function liftPts(twinHits: number, baselineHits: number, n: number): number {
  if (n === 0) return 0;
  return Math.round(((twinHits - baselineHits) / n) * 1000) / 10;
}
