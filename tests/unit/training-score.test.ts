import { describe, expect, it } from "vitest";
import type { TraitScore } from "@/contracts";
import { blindSpots, consistencyCeiling, readiness, scoreTraits } from "@/lib/training/score";

const t = (trait: TraitScore["trait"], score: number, sampleCount: number, source: TraitScore["source"]): TraitScore => ({
  trait,
  score,
  sampleCount,
  source,
});

describe("scoreTraits", () => {
  it("returns all 8 traits, neutral 0.5 when unknown", () => {
    const s = scoreTraits([]);
    expect(s).toHaveLength(8);
    s.forEach((x) => expect(x).toMatchObject({ score: 0.5, sampleCount: 0, source: "stated" }));
  });

  it("averages signed weights and maps to 0..1", () => {
    const s = scoreTraits([
      { questionId: "q1", weights: { risk_tolerance: 0.8, opportunity_over_stability: 0.9 } },
      { questionId: "q2", weights: { risk_tolerance: 0.4 } },
    ]);
    const risk = s.find((x) => x.trait === "risk_tolerance")!;
    expect(risk.score).toBeCloseTo(0.5 + 0.5 * 0.6);
    expect(risk.sampleCount).toBe(2);
  });

  it("clamps to [0,1]", () => {
    const s = scoreTraits([{ questionId: "q", weights: { frugality: -1 } }]);
    expect(s.find((x) => x.trait === "frugality")!.score).toBe(0);
  });
});

describe("readiness", () => {
  it("counts dimensions with at least one signal", () => {
    const s = scoreTraits([{ questionId: "q", weights: { frugality: 0.5, procrastination: 0.2 } }]);
    expect(readiness(s)).toEqual({ known: 2, total: 8 });
  });
});

describe("consistencyCeiling", () => {
  it("is null without retest pairs, else the agreement share", () => {
    expect(consistencyCeiling([])).toBeNull();
    expect(
      consistencyCeiling([
        { first: "a", second: "a" },
        { first: "a", second: "b" },
        { first: "c", second: "c" },
        { first: "d", second: "d" },
      ]),
    ).toBe(0.75);
  });
});

describe("blindSpots", () => {
  const stated = [t("opportunity_over_stability", 0.2, 3, "stated"), t("frugality", 0.8, 2, "stated")];

  it("flags big gaps with enough real decisions", () => {
    const spots = blindSpots(stated, [t("opportunity_over_stability", 0.8, 5, "revealed")]);
    expect(spots).toHaveLength(1);
    expect(spots[0]!.gap).toBeCloseTo(0.6);
  });

  it("ignores small gaps and thin evidence", () => {
    expect(blindSpots(stated, [t("frugality", 0.6, 10, "revealed")])).toEqual([]);
    expect(blindSpots(stated, [t("opportunity_over_stability", 0.9, 2, "revealed")])).toEqual([]);
  });
});
