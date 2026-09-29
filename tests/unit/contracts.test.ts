import { describe, expect, it } from "vitest";
import {
  CouncilResult,
  CouncilSynthesis,
  DuelRound,
  DuelScenario,
  DuelScoreboard,
  Memory,
  MemoryRevision,
  OptionList,
  PredictRequest,
  Prediction,
  Simulation,
  TwinStreamEvent,
  sampleForOptions,
} from "@/contracts";
import * as fx from "@/lib/mock/fixtures";

describe("mock fixtures match their contracts", () => {
  it.each([
    ["prediction", Prediction, fx.prediction],
    ["predictionAsOfSpring", Prediction, fx.predictionAsOfSpring],
    ["council", CouncilResult, fx.council],
    ["simulation", Simulation, fx.simulation],
    ["revision", MemoryRevision, fx.revision],
    ["duelRound", DuelRound, fx.duelRound],
    ["duelScoreboard", DuelScoreboard, fx.duelScoreboard],
  ] as const)("%s", (_name, schema, value) => {
    const r = schema.safeParse(value);
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues, null, 2)).toBe(true);
  });

  it("memories, duel scenarios and the chat stream", () => {
    fx.memories.forEach((m) => Memory.parse(m));
    fx.duelScenarios.forEach((s) => DuelScenario.parse(s));
    fx.chatStream.forEach((e) => TwinStreamEvent.parse(e));
  });

  it("prediction distributions sum to 1 and topChoice is the max", () => {
    for (const p of [fx.prediction, fx.predictionAsOfSpring]) {
      const total = Object.values(p.distribution).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1);
      expect(p.options).toContain(p.topChoice);
    }
  });
});

describe("contract refinements", () => {
  it("drops samples whose choice isn't an option", () => {
    const schema = sampleForOptions(["A", "B"]);
    const base = { rationale: [], citedEvidenceIds: [], missingInfo: [] };
    expect(schema.safeParse({ ...base, choice: "A" }).success).toBe(true);
    expect(schema.safeParse({ ...base, choice: "C" }).success).toBe(false);
  });

  it("requires distinct options", () => {
    expect(OptionList.safeParse(["Yes", "yes"]).success).toBe(false);
    expect(OptionList.safeParse(["Yes"]).success).toBe(false);
    expect(OptionList.safeParse(["Yes", "No"]).success).toBe(true);
  });

  it("defaults category and asOf on predict requests", () => {
    expect(PredictRequest.parse({ scenario: "Should I move to Lisbon?" })).toMatchObject({ category: "other", asOf: null });
  });

  it("forbids the council from returning a finalDecision", () => {
    const withVerdict = { ...fx.council.synthesis, finalDecision: "Take the job" };
    expect(CouncilSynthesis.safeParse(withVerdict).success).toBe(false);
  });

  it("requires ≥ 2 trade-offs per simulated option (optimism-bias guard)", () => {
    const bad = { ...fx.simulation, optionA: { ...fx.simulation.optionA, possibleTradeoffs: ["only one"] } };
    expect(Simulation.safeParse(bad).success).toBe(false);
  });
});
