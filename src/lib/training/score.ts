import { TraitKey, type TraitScore, type TraitWeights } from "@/contracts";

/**
 * Deterministic Decision DNA scoring (plan §11.8). No model involved.
 *
 * Each answer contributes its option's signed weights (−1..1) per trait. A trait's score is
 * 0.5 + 0.5 × (mean contribution), so 0.5 = neutral / unknown and 1 = the named pole.
 */

export interface AnsweredOption {
  questionId: string;
  weights: TraitWeights;
}

export const ALL_TRAITS = TraitKey.options;

export function scoreTraits(answers: readonly AnsweredOption[], source: TraitScore["source"] = "stated"): TraitScore[] {
  const sums = new Map<TraitKey, { total: number; count: number }>();
  for (const a of answers) {
    for (const [trait, w] of Object.entries(a.weights) as [TraitKey, number | undefined][]) {
      if (w === undefined) continue;
      const s = sums.get(trait) ?? { total: 0, count: 0 };
      s.total += w;
      s.count += 1;
      sums.set(trait, s);
    }
  }
  return ALL_TRAITS.map((trait) => {
    const s = sums.get(trait);
    const mean = s ? s.total / s.count : 0;
    return {
      trait,
      score: Math.min(1, Math.max(0, 0.5 + 0.5 * mean)),
      sampleCount: s?.count ?? 0,
      source,
    };
  });
}

/** "Your twin now knows 6 of 8 decision dimensions" — traits with ≥ 1 signal. */
export function readiness(scores: readonly TraitScore[]): { known: number; total: number } {
  return { known: scores.filter((s) => s.sampleCount > 0).length, total: ALL_TRAITS.length };
}

/**
 * Self-Consistency Ceiling (§11.5): share of retest questions answered the same way twice.
 * Returns null until at least one retest pair exists.
 */
export function consistencyCeiling(
  pairs: readonly { first: string; second: string }[],
): number | null {
  if (pairs.length === 0) return null;
  return pairs.filter((p) => p.first === p.second).length / pairs.length;
}

export interface BlindSpot {
  trait: TraitKey;
  stated: number;
  revealed: number;
  gap: number;
  samples: number;
}

/**
 * Blind Spot Mirror (F6): stated (quiz) vs revealed (real choices).
 * Shown only when the gap is ≥ 0.3 with ≥ 3 revealed samples.
 */
export function blindSpots(
  stated: readonly TraitScore[],
  revealed: readonly TraitScore[],
  { minGap = 0.3, minSamples = 3 } = {},
): BlindSpot[] {
  const byTrait = new Map(stated.map((s) => [s.trait, s]));
  return revealed
    .filter((r) => r.sampleCount >= minSamples)
    .flatMap((r) => {
      const s = byTrait.get(r.trait);
      if (!s || s.sampleCount === 0) return [];
      const gap = r.score - s.score;
      return Math.abs(gap) >= minGap
        ? [{ trait: r.trait, stated: s.score, revealed: r.score, gap, samples: r.sampleCount }]
        : [];
    })
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
}
