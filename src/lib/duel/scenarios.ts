import type { DuelScenario, TraitScore, TraitWeights } from "@/contracts";

/**
 * "Predict Me" scenario bank (F9). Each option carries trait weights, so every round the user
 * plays is also a REVEALED-preference signal for the Blind Spot Mirror (F6).
 */
export interface WeightedDuelScenario extends DuelScenario {
  weights: Record<string, TraitWeights>;
}

export const DUEL_SCENARIOS: WeightedDuelScenario[] = [
  {
    id: "weekend-trip", category: "lifestyle",
    scenario: "A friend invites you on a last-minute weekend trip. You have a deadline Monday.",
    options: ["Go on the trip", "Stay and work"],
    weights: { "Go on the trip": { social_influence: 0.6, procrastination: 0.6, risk_tolerance: 0.3 }, "Stay and work": { procrastination: -0.7, long_term_focus: 0.5 } },
  },
  {
    id: "bonus", category: "money",
    scenario: "You get a surprise €2,000 bonus.",
    options: ["Save it", "Spend it on a course", "Treat yourself"],
    weights: { "Save it": { frugality: 0.9 }, "Spend it on a course": { long_term_focus: 0.8, opportunity_over_stability: 0.4 }, "Treat yourself": { frugality: -0.8 } },
  },
  {
    id: "risky-project", category: "career",
    scenario: "Your manager offers you the lead on a risky new project that could fail publicly.",
    options: ["Take it", "Politely decline"],
    weights: { "Take it": { risk_tolerance: 0.8, opportunity_over_stability: 0.7 }, "Politely decline": { risk_tolerance: -0.7, opportunity_over_stability: -0.5 } },
  },
  {
    id: "phone-upgrade", category: "money",
    scenario: "Your phone works fine, but the new model just launched with a trade-in deal.",
    options: ["Upgrade now", "Keep the old one"],
    weights: { "Upgrade now": { frugality: -0.7, gut_over_analysis: 0.4 }, "Keep the old one": { frugality: 0.8 } },
  },
  {
    id: "group-restaurant", category: "relationships",
    scenario: "Your group picks a restaurant you don't love for a birthday dinner.",
    options: ["Go along happily", "Suggest another place"],
    weights: { "Go along happily": { social_influence: 0.8, independence: -0.4 }, "Suggest another place": { independence: 0.7, social_influence: -0.4 } },
  },
  {
    id: "course-signup", category: "learning",
    scenario: "A great online course starts today. You're busy this month.",
    options: ["Sign up today", "Bookmark it for later"],
    weights: { "Sign up today": { procrastination: -0.6, long_term_focus: 0.6 }, "Bookmark it for later": { procrastination: 0.7 } },
  },
  {
    id: "gut-apartment", category: "lifestyle",
    scenario: "You view an apartment that feels perfect, but you've only seen one place.",
    options: ["Sign the lease today", "See three more first"],
    weights: { "Sign the lease today": { gut_over_analysis: 0.9, risk_tolerance: 0.4 }, "See three more first": { gut_over_analysis: -0.8 } },
  },
  {
    id: "job-hop", category: "career",
    scenario: "A recruiter offers 15% more at a less stable startup.",
    options: ["Take the interview", "Stay where you are"],
    weights: { "Take the interview": { opportunity_over_stability: 0.8, risk_tolerance: 0.5 }, "Stay where you are": { opportunity_over_stability: -0.8 } },
  },
  {
    id: "morning-run", category: "health",
    scenario: "It's raining at 6am on the day you planned your first morning run.",
    options: ["Run anyway", "Start tomorrow"],
    weights: { "Run anyway": { long_term_focus: 0.6, procrastination: -0.7 }, "Start tomorrow": { procrastination: 0.8 } },
  },
  {
    id: "advice-career", category: "career",
    scenario: "Your parents strongly prefer you take the 'safe' career path you're unsure about.",
    options: ["Follow their advice", "Choose your own path"],
    weights: { "Follow their advice": { social_influence: 0.8, independence: -0.8 }, "Choose your own path": { independence: 0.9 } },
  },
];

export const duelById = new Map(DUEL_SCENARIOS.map((s) => [s.id, s]));

/** Public shape: never send weights to the browser (they'd give away the "right" answer). */
export const publicScenario = ({ id, scenario, options, category }: WeightedDuelScenario): DuelScenario => ({ id, scenario, options, category });

export function nextScenario(played: ReadonlySet<string>): WeightedDuelScenario {
  return DUEL_SCENARIOS.find((s) => !played.has(s.id)) ?? DUEL_SCENARIOS[played.size % DUEL_SCENARIOS.length]!;
}

/** Demo-mode twin: the option whose trait weights best fit the user's stated traits. */
export function traitFitChoice(s: WeightedDuelScenario, traits: readonly TraitScore[]): { choice: string; distribution: Record<string, number> } {
  const t = new Map(traits.filter((x) => x.sampleCount > 0).map((x) => [x.trait, x.score - 0.5]));
  const fit = s.options.map((o) => {
    const w = s.weights[o] ?? {};
    return Object.entries(w).reduce((acc, [trait, v]) => acc + (v ?? 0) * (t.get(trait as TraitScore["trait"]) ?? 0), 0);
  });
  // softmax over fit (sharpened) → a vote-share-like distribution
  const exps = fit.map((f) => Math.exp(f * 6));
  const sum = exps.reduce((a, b) => a + b, 0);
  const distribution = Object.fromEntries(s.options.map((o, i) => [o, Math.round((exps[i]! / sum) * 100) / 100]));
  const best = fit.indexOf(Math.max(...fit));
  return { choice: s.options[best]!, distribution };
}

/** Demo-mode stranger: the least extreme option — what "people in general" pick. */
export function typicalChoice(s: WeightedDuelScenario): string {
  const extremity = s.options.map((o) => Object.values(s.weights[o] ?? {}).reduce((a, v) => a + Math.abs(v ?? 0), 0));
  return s.options[extremity.indexOf(Math.min(...extremity))]!;
}

/** Revealed traits from the options the user actually picked in duels. */
export function revealedWeights(rounds: readonly { scenarioId: string; userChoice: string }[]) {
  return rounds.flatMap((r) => {
    const w = duelById.get(r.scenarioId)?.weights[r.userChoice];
    return w ? [{ questionId: r.scenarioId, weights: w }] : [];
  });
}
