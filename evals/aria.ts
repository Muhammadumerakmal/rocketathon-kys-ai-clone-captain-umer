import type { TraitScore } from "@/contracts";
import { promptSafeMemories, toEvidence, type TwinContext } from "@/lib/ai/context";

/**
 * Golden persona "Aria" (plan §13): strongly idiosyncratic on purpose, so a twin that
 * uses her data should diverge from a generic stranger.
 */
const m = (n: number, kind: TwinContext["memories"][number]["kind"], content: string, validFrom = "2026-06-01T00:00:00.000Z") => ({
  id: `00000000-0000-4000-8000-${(0xa000 + n).toString(16).padStart(12, "0")}`,
  kind,
  content,
  validFrom,
  importance: 0.8,
  relevance: 1 - n * 0.05,
});

export const ARIA_MEMORIES = [
  m(1, "value", "Since my rent went up I value financial stability over exciting opportunities."),
  m(2, "goal", "My goal this year is a 6-month emergency fund; I'm at 2 months."),
  m(3, "procedural", "I never take unpaid work — I did it once and couldn't pay rent."),
  m(4, "procedural", "I hate crowds and loud parties; I recharge alone at home."),
  m(5, "value", "I'd rather cook at home than eat out; eating out feels like wasted money."),
  m(6, "episodic", "Last spring I turned down a free festival ticket to stay in and study."),
];

const t = (trait: TraitScore["trait"], score: number): TraitScore => ({ trait, score, sampleCount: 3, source: "stated" });

export function ariaContext(overrides: Partial<TwinContext> = {}): TwinContext {
  const memories = promptSafeMemories(ARIA_MEMORIES);
  return {
    userId: "aria",
    twinName: "Aria",
    asOf: null,
    memories,
    evidence: memories.map(toEvidence),
    profile: {
      stated: [t("risk_tolerance", 0.15), t("opportunity_over_stability", 0.15), t("frugality", 0.9), t("social_influence", 0.2)],
      revealed: [],
      goals: [{ id: "00000000-0000-4000-8000-00000000b001", title: "Build a 6-month emergency fund", priority: 1 }],
    },
    contradicted: new Set(),
    ...overrides,
  };
}

/** Held-out scenarios with ground truth written from Aria's memories, where a stranger plausibly differs. */
export const ARIA_SCENARIOS = [
  { scenario: "A friend offers you a free ticket to a huge music festival this weekend.", options: ["Go to the festival", "Stay home"], truth: "Stay home" },
  { scenario: "You're offered an unpaid 3-month internship at a famous design studio.", options: ["Take the unpaid internship", "Decline and keep your paid job"], truth: "Decline and keep your paid job" },
  { scenario: "Friends invite you to a fancy restaurant for dinner on Friday.", options: ["Go to the restaurant", "Suggest cooking together at home"], truth: "Suggest cooking together at home" },
] as const;
