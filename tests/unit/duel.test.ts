import { describe, expect, it } from "vitest";
import { DuelScenario, type DuelRound, type TraitScore } from "@/contracts";
import { DUEL_SCENARIOS, duelById, nextScenario, publicScenario, revealedWeights, traitFitChoice, typicalChoice } from "@/lib/duel/scenarios";
import { scoreboard } from "@/lib/duel/score";
import { scoreTraits } from "@/lib/training/score";

const trait = (t: TraitScore["trait"], score: number): TraitScore => ({ trait: t, score, sampleCount: 2, source: "stated" });

describe("duel scenario bank", () => {
  it("every scenario is valid and every option has weights", () => {
    for (const s of DUEL_SCENARIOS) {
      DuelScenario.parse(publicScenario(s));
      s.options.forEach((o) => expect(s.weights[o], `${s.id}/${o}`).toBeDefined());
    }
  });

  it("never leaks weights to the browser", () => {
    expect(publicScenario(DUEL_SCENARIOS[0]!)).not.toHaveProperty("weights");
  });

  it("serves unplayed scenarios first, then cycles", () => {
    expect(nextScenario(new Set()).id).toBe(DUEL_SCENARIOS[0]!.id);
    expect(nextScenario(new Set([DUEL_SCENARIOS[0]!.id])).id).toBe(DUEL_SCENARIOS[1]!.id);
    expect(nextScenario(new Set(DUEL_SCENARIOS.map((s) => s.id)))).toBeDefined();
  });
});

describe("demo twin vs stranger", () => {
  const risky = duelById.get("risky-project")!;

  it("a risk-seeking user's twin takes the risky project", () => {
    expect(traitFitChoice(risky, [trait("risk_tolerance", 0.95), trait("opportunity_over_stability", 0.9)]).choice).toBe("Take it");
  });

  it("a cautious user's twin declines", () => {
    const r = traitFitChoice(risky, [trait("risk_tolerance", 0.1), trait("opportunity_over_stability", 0.1)]);
    expect(r.choice).toBe("Politely decline");
    expect(Object.values(r.distribution).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 1);
  });

  it("the stranger picks the least extreme option", () => {
    expect(typicalChoice(duelById.get("bonus")!)).toBe("Treat yourself");
  });
});

describe("scoreboard + revealed traits", () => {
  const round = (twin: boolean, stranger: boolean): DuelRound => ({
    id: "00000000-0000-4000-8000-000000000001",
    scenario: publicScenario(DUEL_SCENARIOS[0]!),
    userChoice: "a",
    twinChoice: twin ? "a" : "b",
    twinDistribution: {},
    baselineChoice: stranger ? "a" : "b",
    twinMatched: twin,
    baselineMatched: stranger,
  });

  it("computes lift in points", () => {
    expect(scoreboard([round(true, false), round(true, true), round(false, false), round(true, false)])).toEqual({
      rounds: 4,
      twinHits: 3,
      baselineHits: 1,
      liftPts: 50,
    });
    expect(scoreboard([]).liftPts).toBe(0);
  });

  it("turns duel choices into revealed trait signals", () => {
    const revealed = scoreTraits(revealedWeights([{ scenarioId: "risky-project", userChoice: "Take it" }]), "revealed");
    const risk = revealed.find((t) => t.trait === "risk_tolerance")!;
    expect(risk.score).toBeGreaterThan(0.8);
    expect(risk.source).toBe("revealed");
  });
});
