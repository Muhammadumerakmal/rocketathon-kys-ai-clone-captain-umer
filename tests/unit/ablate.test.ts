import { describe, expect, it } from "vitest";
import { isPivotal } from "@/lib/ai/ablate";

const OPTS = ["A", "B"];
const before = { distribution: { A: 1, B: 0 }, topChoice: "A" };

describe("isPivotal (counterfactual rule)", () => {
  it("is pivotal when removing the memory flips the answer", () => {
    expect(isPivotal(before, { A: 1 / 3, B: 2 / 3 }, OPTS)).toBe(true);
  });

  it("is pivotal when the top share drops by ≥ 0.4 without flipping", () => {
    expect(isPivotal({ distribution: { A: 1, B: 0 }, topChoice: "A" }, { A: 0.6, B: 0.4 }, OPTS)).toBe(true);
  });

  it("is not pivotal for a small wobble", () => {
    expect(isPivotal(before, { A: 2 / 3, B: 1 / 3 }, OPTS)).toBe(false);
    expect(isPivotal(before, { A: 1, B: 0 }, OPTS)).toBe(false);
  });
});
