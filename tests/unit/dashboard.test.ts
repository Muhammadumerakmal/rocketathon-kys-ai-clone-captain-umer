import { describe, expect, it } from "vitest";
import type { TraitScore } from "@/contracts";
import { computeDashboard, type DashboardInput } from "@/lib/analytics/dashboard";
import { scoreTraits } from "@/lib/training/score";

const empty: DashboardInput = {
  stated: scoreTraits([]),
  revealed: [],
  categories: [],
  points: [],
  ceiling: null,
  memoryCount: 0,
  openRevisions: 0,
};

describe("computeDashboard", () => {
  it("renders an honest empty state (nulls, not zeros)", () => {
    const d = computeDashboard(empty);
    expect(d.resolved).toBe(0);
    expect(d.twinAccuracy).toBeNull();
    expect(d.brier).toBeNull();
    expect(d.liftPts).toBe(0);
    expect(d.reliability).toHaveLength(5);
  });

  it("aggregates categories into lift, accuracy and Brier", () => {
    const d = computeDashboard({
      ...empty,
      categories: [
        { category: "career", n: 6, hits: 5, brierSum: 0.6, baselineHits: 2 },
        { category: "money", n: 4, hits: 2, brierSum: 1.0, baselineHits: 2 },
      ],
    });
    expect(d.resolved).toBe(10);
    expect(d.twinAccuracy).toBeCloseTo(0.7);
    expect(d.strangerAccuracy).toBeCloseTo(0.4);
    expect(d.liftPts).toBe(30);
    expect(d.brier).toBeCloseTo(0.16);
    expect(d.byCategory[0]!.category).toBe("career");
  });

  it("measures the twin against the user's own consistency", () => {
    const d = computeDashboard({ ...empty, ceiling: 0.8, categories: [{ category: "career", n: 10, hits: 6, brierSum: 2, baselineHits: 4 }] });
    expect(d.relativeToCeiling).toBeCloseTo(0.75);
  });

  it("surfaces blind spots from stated vs revealed traits", () => {
    const stated: TraitScore[] = [{ trait: "opportunity_over_stability", score: 0.2, sampleCount: 3, source: "stated" }];
    const revealed: TraitScore[] = [{ trait: "opportunity_over_stability", score: 0.85, sampleCount: 4, source: "revealed" }];
    expect(computeDashboard({ ...empty, stated, revealed }).blindSpots).toHaveLength(1);
  });
});
