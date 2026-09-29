import { describe, expect, it } from "vitest";
import { MemorySuggestion } from "@/contracts";
import { dedupeSuggestions, heuristicSuggestions, mightContainFact, overlap } from "@/lib/ai/memory-suggest";

describe("memory picking from chat", () => {
  it("skips messages with no first-person fact (no model call needed)", () => {
    expect(mightContainFact("What should I do about the job offer?")).toBe(true); // mentions I → worth checking
    expect(mightContainFact("hi")).toBe(false);
    expect(mightContainFact("What is the capital of France?")).toBe(false);
    expect(mightContainFact("I've started running every morning")).toBe(true);
  });

  it("drops suggestions the twin already knows and in-batch duplicates", () => {
    const known = ["I run every morning before work."];
    const out = dedupeSuggestions(
      [
        { content: "I run every morning before work", kind: "procedural" },
        { content: "I want to save for a flat.", kind: "goal" },
        { content: "I want to save for a flat!", kind: "goal" },
      ],
      known,
    );
    expect(out.map((s) => s.content)).toEqual(["I want to save for a flat."]);
  });

  it("overlap is 1 for identical content and 0 for unrelated", () => {
    expect(overlap("I love hiking", "I love hiking")).toBe(1);
    expect(overlap("I love hiking", "Budget spreadsheet")).toBe(0);
  });

  it("demo heuristic extracts contract-valid first-person facts only", () => {
    const s = heuristicSuggestions("I always cook at home on weekdays. Should I buy a car? My friend loves cars. I want to save for a flat.");
    expect(s.map((x) => x.kind)).toEqual(["procedural", "goal"]);
    s.forEach((x) => MemorySuggestion.parse(x));
  });
});
