import { describe, expect, it } from "vitest";
import { cumulativeAccuracy, indexAt, leadSentence, linePath, type LedgerEntry } from "@/lib/analytics/ledger";

const e = (twin: boolean, stranger: boolean): LedgerEntry => ({ at: "2026-09-29T00:00:00Z", scenario: "x", twinCorrect: twin, baselineCorrect: stranger });

describe("insights ledger (plan §6.6)", () => {
  it("computes cumulative accuracy for twin and stranger", () => {
    expect(cumulativeAccuracy([e(true, false), e(true, true), e(false, false), e(true, false)])).toEqual([
      { n: 1, twin: 1, stranger: 0 },
      { n: 2, twin: 1, stranger: 0.5 },
      { n: 3, twin: 2 / 3, stranger: 1 / 3 },
      { n: 4, twin: 0.75, stranger: 0.25 },
    ]);
  });

  it("writes the lead sentence in plain words", () => {
    expect(leadSentence([])).toMatch(/Confirm a few predictions/);
    expect(leadSentence([e(true, true), e(true, false), e(false, false)])).toBe("Your twin matched you 2 of 3 times. A stranger matched 1.");
    expect(leadSentence([e(true, false)])).toBe("Your twin matched you 1 of 1 time. A stranger matched 0.");
  });

  it("draws a path across the box with 1 at the top", () => {
    expect(linePath([1, 0], 100, 50)).toBe("M0.0,0.0 L100.0,50.0");
    expect(linePath([0.5], 100, 50)).toBe("M50.0,25.0");
    expect(linePath([], 100, 50)).toBe("");
  });

  it("maps a pointer position to the nearest decision", () => {
    expect(indexAt(0, 300, 7)).toBe(0);
    expect(indexAt(300, 300, 7)).toBe(6);
    expect(indexAt(160, 300, 7)).toBe(3);
    expect(indexAt(-20, 300, 7)).toBe(0);
    expect(indexAt(50, 300, 1)).toBe(0);
  });
});
