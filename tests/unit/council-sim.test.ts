import { describe, expect, it } from "vitest";
import { Lens } from "@/contracts";
import { lensesFromGoals, shortName } from "@/lib/ai/council";
import { sanitizeSimulation } from "@/lib/ai/simulate";
import { simulation } from "@/lib/mock/fixtures";

const goal = (id: string, title: string, priority = 1) => ({ id, title, priority });
const G1 = "00000000-0000-4000-8000-00000000b001";

describe("lensesFromGoals", () => {
  it("builds up to 3 contract-valid lenses from goals", () => {
    const lenses = lensesFromGoals([
      goal(G1, "Build a 6-month emergency fund"),
      goal("00000000-0000-4000-8000-00000000b002", "Ship my startup MVP"),
      goal("00000000-0000-4000-8000-00000000b003", "Sleep 7 hours a night"),
      goal("00000000-0000-4000-8000-00000000b004", "Learn Spanish"),
    ]);
    expect(lenses).toHaveLength(3);
    lenses.forEach((l) => Lens.parse(l));
    expect(lenses.map((l) => l.name)).toEqual(["Emergency-Me", "Ship-Me", "Sleep-Me"]);
    expect(lenses[0]!.goalId).toBe(G1);
  });

  it.each([
    ["Build a 6-month emergency fund", "Emergency"],
    ["My goal this year is to run a marathon", "Run"],
    ["!!!", "Goal"],
  ])("shortName(%s) → %s", (title, name) => {
    expect(shortName(title)).toBe(name);
  });

  it("falls back to Present-Me / Future-Me when there are no goals", () => {
    expect(lensesFromGoals([]).map((l) => l.name)).toEqual(["Present-Me", "Future-Me"]);
  });
});

describe("sanitizeSimulation", () => {
  it("drops goal alignments for ids that aren't the user's goals", () => {
    const tampered = {
      ...simulation,
      optionA: { ...simulation.optionA, goalAlignment: [...simulation.optionA.goalAlignment, { goalId: "made-up", score: 1 }] },
    };
    const clean = sanitizeSimulation(tampered, new Set([simulation.optionA.goalAlignment[0]!.goalId]));
    expect(clean.optionA.goalAlignment.map((g) => g.goalId)).not.toContain("made-up");
    expect(clean.optionA.goalAlignment).toHaveLength(1);
  });
});
