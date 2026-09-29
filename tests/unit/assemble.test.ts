import { describe, expect, it } from "vitest";
import { Prediction, type EvidenceRef, type PredictionSample } from "@/contracts";
import { assemblePrediction, NoValidSamplesError, type AssembleContext } from "@/lib/ai/assemble";
import { mid } from "@/lib/mock/fixtures";

const OPTS = ["Paid safe job", "Unpaid dream internship"];
const retrieved: EvidenceRef[] = [
  { id: mid(2), type: "value", label: "Now values stability", relevance: 1 },
  { id: mid(3), type: "goal", label: "Emergency fund", relevance: 0.8 },
  { id: mid(4), type: "memory", label: "Decides fast under stress", relevance: 0.3 },
];
const ctx: AssembleContext = {
  id: mid(0x999),
  scenario: "Safe job or dream internship?",
  options: OPTS,
  category: "career",
  asOf: null,
  retrieved,
  history: { n: 6, hits: 4 },
  contradicted: new Set(),
  k: 5,
  promptVersion: "predict@1",
  model: "test",
  now: new Date("2026-09-29T09:00:00Z"),
};
const sample = (choice: string, cited: string[] = []): PredictionSample => ({
  choice,
  rationale: [`because ${choice}`],
  citedEvidenceIds: cited,
  missingInfo: ["runway"],
});

describe("assemblePrediction", () => {
  const samples = [
    sample(OPTS[0]!, [mid(2), mid(3)]),
    sample(OPTS[0]!, [mid(2)]),
    sample(OPTS[0]!, [mid(2), "not-a-real-id"]),
    sample(OPTS[0]!, [mid(3)]),
    sample(OPTS[1]!, [mid(4)]),
  ];
  const p = assemblePrediction(samples, OPTS[1]!, ctx);

  it("produces a contract-valid Prediction", () => {
    const r = Prediction.safeParse(p);
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
  });

  it("computes the vote distribution and top choice", () => {
    expect(p.topChoice).toBe(OPTS[0]);
    expect(p.distribution[OPTS[0]!]).toBeCloseTo(0.8);
  });

  it("drops hallucinated evidence ids and ranks by citation count", () => {
    expect(p.evidence.map((e) => e.id)).toEqual([mid(2), mid(3)]);
  });

  it("only counts evidence cited by samples that chose the top option", () => {
    expect(p.evidence.map((e) => e.id)).not.toContain(mid(4));
  });

  it("flags when the stranger disagrees (personalized)", () => {
    expect(p.baseline).toEqual({ choice: OPTS[1], agreesWithTwin: false });
  });

  it("explains confidence in words", () => {
    expect(p.confidence.reasons[0]).toBe("4 of 5 runs agreed");
    expect(p.confidence.reasons[2]).toBe("right 4/6 times on career decisions");
  });

  it("ignores samples whose choice isn't an option", () => {
    const q = assemblePrediction([...samples, sample("Something else")], OPTS[1]!, ctx);
    expect(Object.keys(q.distribution)).toEqual(OPTS);
  });

  it("marks unanimous-but-uncited predictions as under-informed", () => {
    const q = assemblePrediction([sample(OPTS[1]!), sample(OPTS[1]!), sample(OPTS[1]!)], OPTS[1]!, ctx);
    expect(q.underInformed).toBe(true);
    expect(q.baseline.agreesWithTwin).toBe(true);
  });

  it("lowers confidence when cited memories are contradicted", () => {
    const q = assemblePrediction(samples, OPTS[1]!, { ...ctx, contradicted: new Set([mid(2), mid(3)]) });
    expect(q.confidence.value).toBeLessThan(p.confidence.value);
  });

  it("throws when no sample is valid", () => {
    expect(() => assemblePrediction([sample("nope")], OPTS[0]!, ctx)).toThrow(NoValidSamplesError);
  });
});
