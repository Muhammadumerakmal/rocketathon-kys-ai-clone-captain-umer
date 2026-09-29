import { describe, expect, it } from "vitest";
import { rankMemories, recencyDecay, rrfMerge } from "@/lib/ai/ranking";

const NOW = new Date("2026-09-29T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

describe("rrfMerge", () => {
  it("scores items found by both retrievers above single-list hits", () => {
    const s = rrfMerge([
      ["a", "b", "c"],
      ["b", "d"],
    ]);
    expect(s.get("b")).toBeCloseTo(1 / 52 + 1 / 51);
    expect(s.get("b")!).toBeGreaterThan(s.get("a")!);
    expect(s.get("d")).toBeCloseTo(1 / 52);
  });
});

describe("recencyDecay", () => {
  it("is 1 for a memory valid from now", () => {
    expect(recencyDecay(NOW, "episodic", { now: NOW })).toBe(1);
  });

  it("halves the decaying part after one half-life, above the floor", () => {
    expect(recencyDecay(daysAgo(180), "episodic", { now: NOW })).toBeCloseTo(0.35 + 0.65 * 0.5);
  });

  it("never decays values or procedures", () => {
    expect(recencyDecay(daysAgo(3000), "value", { now: NOW })).toBe(1);
    expect(recencyDecay(daysAgo(3000), "procedural", { now: NOW })).toBe(1);
  });

  it("treats future-dated memories as fresh (no boost above 1)", () => {
    expect(recencyDecay(daysAgo(-30), "semantic", { now: NOW })).toBe(1);
  });
});

describe("rankMemories", () => {
  it("combines rrf, importance and recency and normalizes relevance to the best hit", () => {
    const ranked = rankMemories(
      [
        { id: "old", rrfScore: 0.03, importance: 0.5, kind: "episodic", validFrom: daysAgo(720) },
        { id: "new", rrfScore: 0.03, importance: 0.5, kind: "episodic", validFrom: daysAgo(1) },
        { id: "value", rrfScore: 0.02, importance: 1, kind: "value", validFrom: daysAgo(720) },
      ],
      NOW,
    );
    expect(ranked[0]!.id).toBe("new");
    expect(ranked[0]!.relevance).toBe(1);
    expect(ranked.at(-1)!.id).toBe("old");
    ranked.forEach((r) => expect(r.relevance).toBeLessThanOrEqual(1));
  });

  it("measures recency from the as-of moment (time-travel)", () => {
    const march = new Date("2026-03-01T00:00:00Z");
    const [r] = rankMemories(
      [{ id: "m", rrfScore: 0.02, importance: 0, kind: "semantic", validFrom: march }],
      march,
    );
    expect(r!.score).toBeCloseTo(0.02 * 0.7);
  });

  it("returns an empty list for no input", () => {
    expect(rankMemories([], NOW)).toEqual([]);
  });
});
