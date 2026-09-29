import { describe, expect, it } from "vitest";
import {
  betaPosteriorMean,
  brier,
  buildConfidence,
  confidenceBand,
  evidenceStrength,
  isUnderInformed,
  liftPts,
  recalibrate,
  reliabilityBins,
  selfConsistency,
  topChoice,
  twinConfidence,
  voteDistribution,
} from "@/lib/ai/confidence";

const OPTS = ["A", "B", "C"];

describe("voteDistribution", () => {
  it("turns k samples into shares that sum to 1", () => {
    const d = voteDistribution(["A", "A", "B", "A", "C"], OPTS);
    expect(d.A).toBeCloseTo(0.6);
    expect(d.B).toBeCloseTo(0.2);
    expect(Object.values(d).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it("ignores choices outside the options", () => {
    expect(voteDistribution(["A", "Z"], OPTS)).toEqual({ A: 1, B: 0, C: 0 });
  });

  it("returns all zeros when no sample is valid", () => {
    expect(voteDistribution([], OPTS)).toEqual({ A: 0, B: 0, C: 0 });
  });
});

describe("topChoice / selfConsistency", () => {
  it("breaks ties by option order", () => {
    expect(topChoice({ A: 0.4, B: 0.4, C: 0.2 }, OPTS)).toBe("A");
    expect(topChoice({ A: 0.2, B: 0.4, C: 0.4 }, OPTS)).toBe("B");
  });

  it("S is the top vote share", () => {
    expect(selfConsistency({ A: 0.8, B: 0.2 })).toBe(0.8);
  });
});

describe("evidenceStrength", () => {
  it("is 0 with no cited evidence", () => {
    expect(evidenceStrength({ citedRelevances: [], retrievedCount: 10, contradictions: 0 })).toBe(0);
  });

  it("rewards up to 3 strong cited memories without penalising a large retrieval set", () => {
    expect(evidenceStrength({ citedRelevances: [1, 0.9, 0.8], retrievedCount: 12, contradictions: 0 })).toBeCloseTo(0.9);
  });

  it("penalises thin coverage", () => {
    expect(evidenceStrength({ citedRelevances: [0.9], retrievedCount: 12, contradictions: 0 })).toBeCloseTo(0.3);
  });

  it("subtracts 0.1 per unresolved contradiction, floored at 0", () => {
    expect(evidenceStrength({ citedRelevances: [1, 1, 1], retrievedCount: 3, contradictions: 2 })).toBeCloseTo(0.8);
    expect(evidenceStrength({ citedRelevances: [0.1], retrievedCount: 3, contradictions: 5 })).toBe(0);
  });
});

describe("twinConfidence", () => {
  it("uses the Beta(2,2) prior: no history → 0.5", () => {
    expect(betaPosteriorMean(0, 0)).toBe(0.5);
    expect(betaPosteriorMean(4, 6)).toBeCloseTo(0.6);
  });

  it("shrinks toward 0.5 with no resolved history", () => {
    // raw = 0.45 + 0.3 + 0.125 = 0.875 → pulled halfway to 0.5: 0.6875
    expect(twinConfidence({ S: 1, E: 1, H: 0.5, n: 0 })).toBeCloseTo(0.6875);
  });

  it("approaches raw as history grows", () => {
    const few = twinConfidence({ S: 1, E: 1, H: 1, n: 2 });
    const many = twinConfidence({ S: 1, E: 1, H: 1, n: 200 });
    expect(many).toBeGreaterThan(few);
    expect(many).toBeLessThanOrEqual(0.95);
  });

  it("is always clamped to [0.05, 0.95]", () => {
    expect(twinConfidence({ S: 1, E: 1, H: 1, n: 10_000 })).toBe(0.95);
    expect(twinConfidence({ S: 0, E: 0, H: 0, n: 10_000 })).toBe(0.05);
  });
});

describe("bands, explanation, guards", () => {
  it("maps values to bands", () => {
    expect(confidenceBand(0.3)).toBe("low");
    expect(confidenceBand(0.61)).toBe("medium");
    expect(confidenceBand(0.8)).toBe("high");
  });

  it("builds human-readable reasons (max 3)", () => {
    const c = buildConfidence({ S: 0.6, E: 0.7, H: 0.6, n: 6, k: 5, strongEvidence: 2, hits: 4, categoryLabel: "career" });
    expect(c.reasons).toEqual(["3 of 5 runs agreed", "2 strong memories support it", "right 4/6 times on career decisions"]);
    expect(c.band).toBe(confidenceBand(c.value));
  });

  it("flags unanimous-but-thin predictions as under-informed", () => {
    expect(isUnderInformed(1, 0.2)).toBe(true);
    expect(isUnderInformed(1, 0.6)).toBe(false);
    expect(isUnderInformed(0.8, 0.1)).toBe(false);
  });
});

describe("calibration", () => {
  it("computes Brier per prediction", () => {
    expect(brier(0.8, true)).toBeCloseTo(0.04);
    expect(brier(0.8, false)).toBeCloseTo(0.64);
  });

  it("bins points, including confidence exactly 1 in the last bin", () => {
    const bins = reliabilityBins([
      { confidence: 0.1, correct: false },
      { confidence: 0.65, correct: true },
      { confidence: 0.7, correct: false },
      { confidence: 1, correct: true },
    ]);
    expect(bins.map((b) => b.count)).toEqual([1, 0, 0, 2, 1]);
    expect(bins[3]!.hitRate).toBe(0.5);
  });

  it("only recalibrates with ≥ 20 resolved and ≥ 3 points in the bin", () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({ confidence: 0.85, correct: i < 10 }));
    const bins = reliabilityBins(pts);
    expect(recalibrate(0.85, bins, 19)).toBe(0.85);
    expect(recalibrate(0.85, bins, 20)).toBeCloseTo(0.5);
    expect(recalibrate(0.3, bins, 20)).toBe(0.3);
  });

  it("computes lift in percentage points", () => {
    expect(liftPts(5, 2, 6)).toBe(50);
    expect(liftPts(0, 0, 0)).toBe(0);
  });
});
