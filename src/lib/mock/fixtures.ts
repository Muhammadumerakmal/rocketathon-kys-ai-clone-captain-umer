import type {
  CouncilResult,
  DuelRound,
  DuelScenario,
  DuelScoreboard,
  Memory,
  MemoryRevision,
  Prediction,
  Simulation,
  TwinStreamEvent,
} from "@/contracts";

/**
 * One valid response per contract, for the demo persona "Aria" (plan §16).
 * Used ONLY when TWIN_MOCK=1 (and by tests); real mode never renders them.
 * Every fixture is validated against its Zod contract in tests/unit/contracts.test.ts.
 */

/** Deterministic, RFC-valid v4 uuids so fixtures are stable across runs. */
export const mid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

export const MOCK_USER_ID = mid(0xa);

export const memories: Memory[] = [
  {
    id: mid(1),
    content: "I love risky bets — I quit a stable job in 2024 to try freelancing.",
    summary: "Loves risky bets",
    kind: "value",
    sourceType: "manual",
    importance: 0.7,
    validFrom: "2024-03-01T00:00:00Z",
    validTo: "2026-09-29T00:00:00Z",
    recordedAt: "2026-03-10T09:00:00Z",
    supersededBy: mid(2),
    influence: "active",
  },
  {
    id: mid(2),
    content: "I've started valuing stability since my rent went up.",
    summary: "Now values stability",
    kind: "value",
    sourceType: "manual",
    importance: 0.8,
    validFrom: "2026-09-29T00:00:00Z",
    validTo: null,
    recordedAt: "2026-09-29T08:00:00Z",
    supersededBy: null,
    influence: "active",
  },
  {
    id: mid(3),
    content: "My goal this year is to save a 6-month emergency fund.",
    summary: "Emergency fund goal",
    kind: "goal",
    sourceType: "manual",
    importance: 0.9,
    validFrom: "2026-01-05T00:00:00Z",
    validTo: null,
    recordedAt: "2026-01-05T10:00:00Z",
    supersededBy: null,
    influence: "active",
  },
  {
    id: mid(4),
    content: "When I'm stressed I decide fast and regret it later.",
    summary: "Decides fast under stress",
    kind: "procedural",
    sourceType: "quiz",
    importance: 0.6,
    validFrom: "2025-06-01T00:00:00Z",
    validTo: null,
    recordedAt: "2026-09-28T12:00:00Z",
    supersededBy: null,
    influence: "active",
  },
  {
    id: mid(5),
    content: "Private journal: therapy notes from August.",
    summary: null,
    kind: "episodic",
    sourceType: "manual",
    importance: 0.5,
    validFrom: "2026-08-12T00:00:00Z",
    validTo: null,
    recordedAt: "2026-08-12T21:00:00Z",
    supersededBy: null,
    influence: "sealed",
  },
];

export const revision: MemoryRevision = {
  id: mid(0x100),
  newMemory: { ...memories[1]!, validTo: null },
  oldMemory: { ...memories[0]!, validTo: null, supersededBy: null },
  verdict: "contradicts",
  explanation: "The new memory says you now prefer stability; the old one says you love risky bets.",
  resolution: null,
  createdAt: "2026-09-29T08:00:05Z",
};

export const prediction: Prediction = {
  id: mid(0x200),
  scenario: "Take a paid, safe job at a bank, or an unpaid internship at my dream design studio?",
  options: ["Paid safe job", "Unpaid dream internship"],
  category: "career",
  distribution: { "Paid safe job": 0.8, "Unpaid dream internship": 0.2 },
  topChoice: "Paid safe job",
  baseline: { choice: "Unpaid dream internship", agreesWithTwin: false },
  evidence: [
    { id: mid(2), type: "value", label: "Now values stability since rent went up", relevance: 1, pivotal: true },
    { id: mid(3), type: "goal", label: "Save a 6-month emergency fund", relevance: 0.82, pivotal: false },
    { id: mid(4), type: "memory", label: "Decides fast under stress, regrets it", relevance: 0.41 },
  ],
  rationale: [
    "Based on what you've told me, stability matters more to you since your rent went up.",
    "An unpaid role would pause your emergency-fund goal.",
  ],
  missingInfo: ["Whether the internship could turn into a paid offer", "How many months of savings you have now"],
  confidence: {
    value: 0.64,
    band: "medium",
    reasons: ["4 of 5 runs agreed", "2 strong memories support it", "right 4/6 times on career decisions"],
  },
  underInformed: false,
  asOf: null,
  status: "open",
  promptVersion: "predict@1",
  model: "mock",
  createdAt: "2026-09-29T09:00:00Z",
};

/** Same scenario asked "as of" spring 2026 — before the stability memory existed (F5). */
export const predictionAsOfSpring: Prediction = {
  ...prediction,
  id: mid(0x201),
  distribution: { "Paid safe job": 0.2, "Unpaid dream internship": 0.8 },
  topChoice: "Unpaid dream internship",
  baseline: { choice: "Unpaid dream internship", agreesWithTwin: true },
  evidence: [{ id: mid(1), type: "value", label: "Loves risky bets", relevance: 1, pivotal: true }],
  rationale: ["Based on what you'd told me by March, you loved risky bets and chasing opportunity."],
  confidence: { value: 0.58, band: "medium", reasons: ["4 of 5 runs agreed", "1 strong memory supports it", "right 4/6 times on career decisions"] },
  asOf: "2026-04-01T00:00:00Z",
};

export const council: CouncilResult = {
  question: "Should I take the paid safe job or the unpaid dream internship?",
  views: [
    {
      lens: { id: "goal-1", name: "Saver-Me", kind: "goal", goalId: mid(3), rubric: "Protect the 6-month emergency fund." },
      view: {
        stance: "Take the paid job; the fund goal is 4 months from done.",
        topReasons: ["Unpaid work drains savings", "Rent went up"],
        riskFlagged: "Staying in a job you dislike can erode motivation.",
      },
    },
    {
      lens: { id: "goal-2", name: "Designer-Me", kind: "goal", goalId: mid(6), rubric: "Build a design career you're proud of." },
      view: {
        stance: "The studio is a rare door; ask for a paid or part-time version.",
        topReasons: ["Dream studios rarely reopen", "Portfolio compounding"],
        riskFlagged: "Burnout from juggling a side job.",
      },
    },
    {
      lens: { id: "devils-advocate", name: "Devil's Advocate", kind: "devils_advocate", goalId: null, rubric: "Argue against the majority." },
      view: {
        stance: "The 'safe' job isn't safe if it kills your design momentum.",
        topReasons: ["Skills atrophy", "Safety can be an illusion"],
        riskFlagged: "Assuming the internship leads anywhere.",
      },
    },
  ],
  synthesis: {
    agreementPoints: ["Your savings runway is the binding constraint"],
    tradeoffs: [{ between: "Saver-Me vs Designer-Me", tension: "Short-term security vs long-term career fit" }],
    questionsForYou: [
      "Could the studio pay a stipend or offer 3 days a week?",
      "How many months could you cover rent with no income?",
      "Would you regret not trying this at 40?",
    ],
  },
};

export const simulation: Simulation = {
  optionA: {
    label: "Paid safe job",
    possibleUpsides: ["Emergency fund done by spring", "Less money stress"],
    possibleTradeoffs: ["Slower design growth", "Might feel stuck"],
    failureMode: "You stay 3 years out of inertia.",
    reversibility: "two-way-door",
    goalAlignment: [{ goalId: mid(3), score: 0.9 }],
    regretCheck: "At 80, would you regret not trying the studio?",
  },
  optionB: {
    label: "Unpaid dream internship",
    possibleUpsides: ["Portfolio leap", "Network at a top studio"],
    possibleTradeoffs: ["Savings shrink", "Rent pressure"],
    failureMode: "Savings run out before a paid offer comes.",
    reversibility: "costly-to-reverse",
    goalAlignment: [{ goalId: mid(3), score: -0.7 }],
    regretCheck: "At 80, would you regret draining your safety net?",
  },
  unknowns: ["Whether the internship converts to paid", "Actual months of runway"],
  cheapestExperiment: "Ask the studio today whether a paid part-time version exists.",
};

export const duelScenarios: DuelScenario[] = [
  { id: "duel-1", scenario: "A friend invites you to a last-minute weekend trip. You have a deadline Monday.", options: ["Go on the trip", "Stay and work"], category: "lifestyle" },
  { id: "duel-2", scenario: "You get a surprise €2,000 bonus.", options: ["Save it", "Spend on a course", "Treat yourself"], category: "money" },
  { id: "duel-3", scenario: "Your manager offers to lead a risky new project.", options: ["Take it", "Politely decline"], category: "career" },
];

export const duelRound: DuelRound = {
  id: mid(0x300),
  scenario: duelScenarios[0]!,
  userChoice: "Stay and work",
  twinChoice: "Stay and work",
  twinDistribution: { "Go on the trip": 0.33, "Stay and work": 0.67 },
  baselineChoice: "Go on the trip",
  twinMatched: true,
  baselineMatched: false,
};

export const duelScoreboard: DuelScoreboard = { rounds: 6, twinHits: 5, baselineHits: 2, liftPts: 50 };

/** Recorded chat stream replayed in mock mode (text deltas + evidence). */
export const chatStream: TwinStreamEvent[] = [
  { type: "meta", chatId: mid(0x400) },
  { type: "evidence", evidence: prediction.evidence.slice(0, 2) },
  { type: "text", delta: "Based on what you've told me, " },
  { type: "text", delta: "stability matters more to you since your rent went up, " },
  { type: "text", delta: "and you're saving for a 6-month emergency fund. " },
  { type: "text", delta: "So I'd expect you to lean toward the paid job — " },
  { type: "text", delta: "but you make the call." },
  { type: "done" },
];
