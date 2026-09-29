import { describe, expect, it } from "vitest";
import { Prediction } from "@/contracts";
import { mockPrediction } from "@/lib/mock/predict";

const base = { id: "00000000-0000-4000-8000-0000000000ff", category: "career" as const, asOf: null, history: { n: 0, hits: 0 } };

describe("mockPrediction", () => {
  it("returns the recorded Aria fixture for the demo scenario, and the spring version when time-travelling", () => {
    const now = mockPrediction({ ...base, scenario: "Paid safe job or unpaid dream internship?" });
    expect(now.topChoice).toBe("Paid safe job");
    const spring = mockPrediction({ ...base, scenario: "Paid safe job or unpaid dream internship?", asOf: "2026-04-01T00:00:00.000Z" });
    expect(spring.topChoice).toBe("Unpaid dream internship");
    expect(spring.asOf).toBe("2026-04-01T00:00:00.000Z");
  });

  it.each([2, 3, 5])("produces a contract-valid prediction over %i custom options", (n) => {
    const options = Array.from({ length: n }, (_, i) => `Option ${i + 1}`);
    const p = mockPrediction({ ...base, scenario: "Which city should I move to next year?", options });
    const r = Prediction.safeParse(p);
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
    expect(Object.values(p.distribution).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 1);
    expect(p.options).toEqual(options);
  });

  it("falls back to two generic options when none are given", () => {
    expect(mockPrediction({ ...base, scenario: "Should I adopt a dog?" }).options).toHaveLength(2);
  });
});
