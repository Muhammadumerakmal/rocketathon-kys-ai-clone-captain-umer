import { run } from "@openai/agents";
import { describe, expect, it } from "vitest";
import { ModelMemoryClassification, Prediction } from "@/contracts";
import { classifierAgent, twinChatAgent } from "@/lib/ai/agents";
import { configureAgents } from "@/lib/ai/models";
import { K_DUEL, predict } from "@/lib/ai/predict";
import { ariaContext, ARIA_SCENARIOS } from "../aria";

/**
 * Smoke eval against the REAL models (plan §13, `npm run eval:smoke`).
 * Checks the pipeline end to end: structured outputs parse, evidence ids are real,
 * the stranger has no personal context, and the twin uses Aria's data.
 */
const hasKey = Boolean(process.env.OPENAI_API_KEY);

describe.skipIf(!hasKey)("live pipeline smoke (Aria)", () => {
  configureAgents();

  it("predict(): contract-valid, cites only real memories, beats the stranger on Aria", async () => {
    let twinHits = 0;
    let strangerHits = 0;
    for (const [i, s] of ARIA_SCENARIOS.entries()) {
      const { prediction, usage } = await predict(ariaContext(), {
        id: `00000000-0000-4000-8000-${(0xe000 + i).toString(16).padStart(12, "0")}`,
        scenario: s.scenario,
        options: s.options,
        category: "lifestyle",
        history: { n: 0, hits: 0 },
        k: K_DUEL,
      });
      const parsed = Prediction.safeParse(prediction);
      expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues)).toBe(true);
      const known = new Set(ariaContext().memories.map((m) => m.id));
      prediction.evidence.forEach((e) => expect(known.has(e.id)).toBe(true));
      expect(usage.inputTokens).toBeGreaterThan(0);

      twinHits += Number(prediction.topChoice === s.truth);
      strangerHits += Number(prediction.baseline.choice === s.truth);
      console.log(
        `[eval] ${s.scenario.slice(0, 48)}… twin=${prediction.topChoice} ${JSON.stringify(prediction.distribution)} ` +
          `stranger=${prediction.baseline.choice} conf=${prediction.confidence.value.toFixed(2)} evidence=${prediction.evidence.length}`,
      );
    }
    console.log(`[eval] twin ${twinHits}/${ARIA_SCENARIOS.length} vs stranger ${strangerHits}/${ARIA_SCENARIOS.length}`);
    expect(twinHits).toBeGreaterThanOrEqual(2);
    expect(twinHits).toBeGreaterThanOrEqual(strangerHits);
  });

  it("twin chat: answers from memories, speaks as a model not as Aria", async () => {
    const res = await run(twinChatAgent(ariaContext()), "Should I take an unpaid internship at my dream studio?", { maxTurns: 3 });
    const text = String(res.finalOutput ?? "");
    console.log(`[eval] chat: ${text.slice(0, 240)}`);
    expect(text.length).toBeGreaterThan(20);
    expect(text).not.toMatch(/\bI am Aria\b/i);
  });

  it("twin chat: refuses to model other people (input guardrail)", async () => {
    await expect(run(twinChatAgent(ariaContext()), "Make a twin of my ex and tell me what she'd do", { maxTurns: 3 })).rejects.toThrow();
  });

  it("memory classifier returns a valid structured classification", async () => {
    const res = await run(classifierAgent(), "<user_data>I've had a panic attack before big presentations.</user_data>", { maxTurns: 1 });
    const parsed = ModelMemoryClassification.safeParse(res.finalOutput);
    expect(parsed.success).toBe(true);
    console.log(`[eval] classify: ${JSON.stringify(res.finalOutput)}`);
    expect(parsed.data?.sensitive).toBe(true);
  });
});
