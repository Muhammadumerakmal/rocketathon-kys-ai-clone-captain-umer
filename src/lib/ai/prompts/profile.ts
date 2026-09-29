import type { TraitScore } from "@/contracts";
import { escapeData } from "./user-data";

/**
 * Decision DNA + goals rendered for prompts (plan §11.1 layer 4).
 * Deliberately contains NO demographics (plan §11.4, enforced by lint).
 */

const TRAIT_LABELS: Record<TraitScore["trait"], [low: string, high: string]> = {
  risk_tolerance: ["risk-averse", "risk-seeking"],
  opportunity_over_stability: ["prefers stability", "prefers opportunity"],
  gut_over_analysis: ["analytical", "gut-driven"],
  long_term_focus: ["short-term focused", "long-term focused"],
  social_influence: ["independent of others' opinions", "strongly influenced by others"],
  procrastination: ["starts early", "tends to procrastinate"],
  independence: ["follows guidance", "carves own path"],
  frugality: ["spends freely", "frugal"],
};

function describe(t: TraitScore): string {
  const [low, high] = TRAIT_LABELS[t.trait];
  const strength = Math.abs(t.score - 0.5);
  if (strength < 0.1) return `${t.trait}: mixed`;
  const qual = strength > 0.3 ? "strongly " : "somewhat ";
  return `${t.trait}: ${qual}${t.score > 0.5 ? high : low} (${t.score.toFixed(2)}, n=${t.sampleCount})`;
}

export interface ProfileInput {
  stated: readonly TraitScore[];
  revealed: readonly TraitScore[];
  goals: readonly { id: string; title: string; priority: number }[];
}

export function profileBlock({ stated, revealed, goals }: ProfileInput): string {
  const known = stated.filter((s) => s.sampleCount > 0);
  const revealedBy = new Map(revealed.filter((r) => r.sampleCount >= 3).map((r) => [r.trait, r]));
  const lines = known.map((s) => {
    const r = revealedBy.get(s.trait);
    const flag = r && Math.abs(r.score - s.score) >= 0.3 ? ` — BUT real choices suggest ${r.score.toFixed(2)} (trust real choices more)` : "";
    return `- ${describe(s)}${flag}`;
  });
  const goalLines = goals.map((g) => `- [${g.id}] ${escapeData(g.title)} (priority ${g.priority})`);
  return [
    "Decision DNA (stated in the quiz; real habits may differ — model actual habits, including inconsistent or irrational ones):",
    lines.length ? lines.join("\n") : "- not trained yet",
    "Active goals:",
    goalLines.length ? goalLines.join("\n") : "- none recorded",
  ].join("\n");
}
