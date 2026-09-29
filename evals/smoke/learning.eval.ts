import { describe, expect, it } from "vitest";
import { validateSignals } from "@/lib/ai/learning";
import { extractLearning } from "@/lib/ai/learning.server";

/**
 * Live checks of natural learning on the Human AI Twin spec's own examples (§5–§8, §39–§43):
 * the FAST model proposes, validateSignals decides what is stored.
 */
const learn = async (msg: string) => {
  const { learning } = await extractLearning(msg);
  const stored = validateSignals(learning.signals);
  console.log(`[eval] "${msg.slice(0, 60)}" → ${JSON.stringify(stored.map((s) => ({ c: s.category, k: s.key, v: s.value, conf: s.confidence, x: s.explicit })))} forget=${JSON.stringify(learning.forget)}`);
  return { stored, forget: learning.forget };
};

describe.skipIf(!process.env.OPENAI_API_KEY)("natural learning (live)", () => {
  it("§39 stores a stated coding preference", async () => {
    const { stored } = await learn("I normally prefer TypeScript over JavaScript.");
    expect(stored).toHaveLength(1);
    expect(stored[0]!.category).toBe("coding");
    expect(stored[0]!.value).toMatch(/typescript/i);
  });

  it("§39 stores a hackathon stack preference with its reason", async () => {
    const { stored } = await learn("For hackathons I prefer Vite because I can build faster.");
    expect(stored.length).toBeGreaterThanOrEqual(1);
    expect(stored.map((s) => s.value).join(" ")).toMatch(/vite/i);
  });

  it("§41 does NOT store temporary context", async () => {
    const { stored } = await learn("I feel like pizza today.");
    expect(stored).toHaveLength(0);
  });

  it("§42 treats 'remember that…' as explicit", async () => {
    const { stored } = await learn("Remember that for hackathons I prefer simple solutions over perfect architecture.");
    expect(stored.length).toBeGreaterThanOrEqual(1);
    expect(stored.some((s) => s.explicit)).toBe(true);
  });

  it("§43 recognizes a forget request", async () => {
    const { stored, forget } = await learn("Forget my React preference.");
    expect(forget.length).toBeGreaterThanOrEqual(1);
    expect(forget.join(" ")).toMatch(/react/i);
    expect(stored).toHaveLength(0);
  });

  it("§4/§27 learns nothing from a general question", async () => {
    const { stored, forget } = await learn("What does useEffect do in React?");
    expect(stored).toHaveLength(0);
    expect(forget).toHaveLength(0);
  });
});
