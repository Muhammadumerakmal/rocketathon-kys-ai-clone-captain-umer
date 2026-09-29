import type { DecisionCategory, Prediction } from "@/contracts";
import { buildConfidence, confidenceBand } from "@/lib/ai/confidence";
import { prediction as demo, predictionAsOfSpring } from "./fixtures";

/**
 * Deterministic stand-in for the live pipeline in TWIN_MOCK=1.
 * The demo scenario returns the recorded Aria fixtures; anything else gets a plausible,
 * contract-valid prediction over the user's own options (twin favours the first, the
 * "stranger" the last, so the Personalized badge shows).
 */
export function mockPrediction(input: {
  id: string;
  scenario: string;
  options?: readonly string[];
  category: DecisionCategory;
  asOf: string | null;
  history: { n: number; hits: number };
}): Prediction {
  const isDemo = /intern/i.test(input.scenario) && /(safe|paid) job/i.test(input.scenario);
  if (isDemo) {
    const base = input.asOf ? predictionAsOfSpring : demo;
    return { ...base, id: input.id, asOf: input.asOf, createdAt: new Date().toISOString() };
  }

  const options = input.options?.length ? [...input.options] : ["Do it", "Don't do it"];
  const shares = options.length === 2 ? [0.6, 0.4] : options.map((_, i) => (i === 0 ? 0.6 : 0.4 / (options.length - 1)));
  const distribution = Object.fromEntries(options.map((o, i) => [o, Math.round(shares[i]! * 100) / 100]));
  const baselineChoice = options[options.length - 1]!;
  const confidence = buildConfidence({
    S: shares[0]!,
    E: 0.4,
    H: (input.history.hits + 2) / (input.history.n + 4),
    n: input.history.n,
    k: 5,
    strongEvidence: 1,
    hits: input.history.hits,
    categoryLabel: input.category,
  });

  return {
    id: input.id,
    scenario: input.scenario,
    options,
    category: input.category,
    distribution,
    topChoice: options[0]!,
    baseline: { choice: baselineChoice, agreesWithTwin: baselineChoice === options[0] },
    evidence: demo.evidence.slice(1, 3).map((e) => ({ ...e, pivotal: false })),
    rationale: ["Based on what you've told me, you weigh long-term goals heavily.", "(Demo mode: connect OpenAI for real reasoning.)"],
    missingInfo: ["How reversible each option is", "What you'd lose by waiting a week"],
    confidence: { ...confidence, band: confidenceBand(confidence.value) },
    underInformed: false,
    asOf: input.asOf,
    status: "open",
    promptVersion: "mock",
    model: "mock",
    createdAt: new Date().toISOString(),
  };
}
