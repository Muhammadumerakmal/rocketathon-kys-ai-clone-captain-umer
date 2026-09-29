import { describe, expect, it } from "vitest";
import type { LearnedSignal } from "@/contracts";
import { CONFIDENCE, heuristicLearning, normalizeKey, planUpsert, validateSignals, type ExistingPreference } from "@/lib/ai/learning";

const sig = (over: Partial<LearnedSignal> = {}): LearnedSignal => ({
  category: "coding",
  key: "preferred_language",
  value: "TypeScript",
  statement: "I normally prefer TypeScript over JavaScript.",
  kind: "value",
  durability: "long_term",
  strength: "stated",
  ...over,
});

describe("validateSignals (spec §6, §7, §26)", () => {
  it("drops temporary context — 'pizza today' is not a preference", () => {
    expect(validateSignals([sig({ durability: "temporary", category: "food", key: "favorite_food", value: "pizza", statement: "I want pizza today." })])).toEqual([]);
  });

  it("derives confidence from how it was said, never at random", () => {
    const [explicit] = validateSignals([sig({ strength: "explicit" })]);
    const [stated] = validateSignals([sig()]);
    const [inferred] = validateSignals([sig({ strength: "inferred" })]);
    expect([explicit!.confidence, stated!.confidence, inferred!.confidence]).toEqual([CONFIDENCE.explicit, CONFIDENCE.stated, CONFIDENCE.inferred]);
  });

  it("rejects unknown categories and unusable keys; collapses duplicates", () => {
    const out = validateSignals([
      sig({ category: "astrology" as LearnedSignal["category"] }),
      sig({ key: "!!!" }),
      sig(),
      sig({ statement: "Again: I prefer TypeScript." }),
    ]);
    expect(out).toHaveLength(1);
    expect(normalizeKey("Hackathon Frontend!")).toBe("hackathon_frontend");
  });
});

describe("planUpsert — conflicting preferences (spec §12)", () => {
  const existing = (over: Partial<ExistingPreference> = {}): ExistingPreference => ({
    id: "m1",
    value: "React",
    content: "I use React for everything.",
    confidence: 0.8,
    sourceType: "conversation",
    ...over,
  });
  const [nextjs] = validateSignals([sig({ key: "preferred_framework", value: "Next.js", statement: "I mostly use Next.js now." })]);

  it("inserts a new preference", () => {
    expect(planUpsert(nextjs!, null)).toEqual({ action: "insert" });
  });

  it("reinforces a repeated preference", () => {
    expect(planUpsert(nextjs!, existing({ value: "next.js" }))).toMatchObject({ action: "reinforce", delta: CONFIDENCE.reinforce });
  });

  it("supersedes an older value instead of keeping both", () => {
    expect(planUpsert(nextjs!, existing())).toEqual({ action: "supersede", id: "m1" });
  });

  it("won't let a weak inference overwrite something the user said explicitly", () => {
    const [weak] = validateSignals([sig({ key: "preferred_framework", value: "Vue", strength: "inferred", statement: "They seem to like Vue." })]);
    expect(planUpsert(weak!, existing({ sourceType: "explicit", confidence: 0.95 })).action).toBe("skip");
    // …but an explicit new statement always wins
    const [explicit] = validateSignals([sig({ key: "preferred_framework", value: "Vue", strength: "explicit", statement: "Remember I switched to Vue." })]);
    expect(planUpsert(explicit!, existing({ sourceType: "explicit", confidence: 0.95 })).action).toBe("supersede");
  });
});

describe("heuristicLearning (demo mode)", () => {
  it("learns stated long-term preferences and explicit remembers", () => {
    const l = heuristicLearning("I normally prefer TypeScript over JavaScript. Remember that for hackathons I prefer simple solutions over perfect architecture.");
    const v = validateSignals(l.signals);
    expect(v.map((s) => [s.key, s.explicit])).toEqual([
      ["preferred_language", false],
      ["hackathon_architecture", true],
    ]);
  });

  it("ignores temporary moods and questions", () => {
    expect(validateSignals(heuristicLearning("I feel like pizza today. What should I cook?").signals)).toEqual([]);
  });

  it("recognizes forget commands", () => {
    expect(heuristicLearning("Forget my React preference.").forget).toEqual(["React preference"]);
    expect(heuristicLearning("I don't prefer React anymore.").forget).toEqual(["React"]);
  });
});
