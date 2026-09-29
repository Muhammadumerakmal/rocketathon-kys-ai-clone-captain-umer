import { describe, expect, it } from "vitest";
import { MemorySuggestion } from "@/contracts";
import { suggestMemories } from "@/lib/ai/memory-suggest.server";

/** Live check of "pick memory from chat": proposes durable first-person facts, and nothing otherwise. */
describe.skipIf(!process.env.OPENAI_API_KEY)("memory picking (live)", () => {
  it("proposes durable facts from a personal message", async () => {
    const { suggestions } = await suggestMemories(
      "Honestly I've started running every morning since July, and I'm trying to save for a flat. Should I join the gym?",
      [],
    );
    console.log(`[eval] picked: ${JSON.stringify(suggestions)}`);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    suggestions.forEach((s) => MemorySuggestion.parse(s));
    expect(suggestions.map((s) => s.content).join(" ")).toMatch(/run|sav/i);
  });

  it("skips facts the twin already knows", async () => {
    const { suggestions } = await suggestMemories("I run every morning before work.", ["I run every morning before work."]);
    expect(suggestions).toHaveLength(0);
  });

  it("proposes nothing for a plain question", async () => {
    const { suggestions } = await suggestMemories("What's a good way to compare two job offers?", []);
    console.log(`[eval] plain question → ${JSON.stringify(suggestions)}`);
    expect(suggestions).toHaveLength(0);
  });
});
