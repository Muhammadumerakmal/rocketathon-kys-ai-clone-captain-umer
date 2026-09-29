import type { TraitKey, TraitWeights } from "@/contracts";

/** Human names for each Decision DNA pole: [low end, high end]. */
export const TRAIT_POLES: Record<TraitKey, [string, string]> = {
  risk_tolerance: ["Risk-averse", "Risk-seeking"],
  opportunity_over_stability: ["Picks stability", "Picks opportunity"],
  gut_over_analysis: ["Analytical", "Goes with gut"],
  long_term_focus: ["Lives in the now", "Plays the long game"],
  social_influence: ["Independent of others", "Swayed by others"],
  procrastination: ["Starts early", "Leaves it late"],
  independence: ["Follows guidance", "Own path"],
  frugality: ["Spends freely", "Frugal"],
};

/**
 * The habit an answer teaches the twin: the option's strongest trait nudge, named by pole.
 * e.g. { risk_tolerance: -0.8, opportunity…: -0.8 } → "Risk-averse".
 */
export function habitFor(weights: TraitWeights): string | null {
  const entries = Object.entries(weights) as [TraitKey, number | undefined][];
  let best: [TraitKey, number] | null = null;
  for (const [k, v] of entries) {
    if (v === undefined || Math.abs(v) < 0.3) continue;
    if (!best || Math.abs(v) > Math.abs(best[1])) best = [k, v];
  }
  if (!best) return null;
  return TRAIT_POLES[best[0]][best[1] > 0 ? 1 : 0];
}
