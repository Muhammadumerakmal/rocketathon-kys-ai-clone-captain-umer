import { describe, expect, it } from "vitest";
import { commitDirection, optionForDirection } from "@/features/training/deck-physics";
import { habitFor } from "@/lib/training/labels";

describe("commitDirection (swipe deck, plan §6.2)", () => {
  it("commits past 100px either way", () => {
    expect(commitDirection(120, 0)).toBe(1);
    expect(commitDirection(-101, 0)).toBe(-1);
  });

  it("commits a fast flick in the same direction after 24px", () => {
    expect(commitDirection(30, 700)).toBe(1);
    expect(commitDirection(-30, -700)).toBe(-1);
  });

  it("springs back for small drags, slow releases and reversed flicks", () => {
    expect(commitDirection(60, 100)).toBe(0);
    expect(commitDirection(20, 900)).toBe(0); // flick, but too short
    expect(commitDirection(40, -900)).toBe(0); // dragged right, flicked left → wobble, not a choice
  });

  it("maps left to the first option and right to the last", () => {
    expect(optionForDirection(["a", "b", "c"], -1)).toBe("a");
    expect(optionForDirection(["a", "b", "c"], 1)).toBe("c");
  });
});

describe("habitFor", () => {
  it("names the strongest trait pole the answer expresses", () => {
    expect(habitFor({ risk_tolerance: -0.8, opportunity_over_stability: -0.6 })).toBe("Risk-averse");
    expect(habitFor({ procrastination: 0.9 })).toBe("Leaves it late");
  });

  it("returns null for weak or empty signals", () => {
    expect(habitFor({ procrastination: 0.1 })).toBeNull();
    expect(habitFor({})).toBeNull();
  });
});
