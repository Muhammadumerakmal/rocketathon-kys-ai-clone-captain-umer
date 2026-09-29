import "server-only";
import { Agent, run, withTrace } from "@openai/agents";
import { PredictionSample, type Prediction } from "@/contracts";
import { topChoice, voteDistribution } from "./confidence";
import type { TwinContext } from "./context";
import { configureAgents, models, TIMEOUTS } from "./models";
import { predictorInstructions } from "./prompts";

/**
 * Counterfactual evidence (F3, plan §11.3): remove each top-3 evidence item, re-run k=3
 * FAST samples, and call it PIVOTAL if the answer flips or the top option's vote share
 * drops by ≥ 0.4. Honest explainability instead of a post-hoc rationale.
 */
export const ABLATION_K = 3;
export const PIVOTAL_DROP = 0.4;

/** Pure decision rule. */
export function isPivotal(
  before: { distribution: Record<string, number>; topChoice: string },
  after: Record<string, number>,
  options: readonly string[],
): boolean {
  const newTop = topChoice(after, options);
  const drop = (before.distribution[before.topChoice] ?? 0) - (after[before.topChoice] ?? 0);
  return newTop !== before.topChoice || drop >= PIVOTAL_DROP - 1e-9;
}

export async function ablate(ctx: TwinContext, p: Prediction): Promise<{ pivotalIds: string[]; usage: { inputTokens: number; outputTokens: number } }> {
  configureAgents();
  const targets = p.evidence.slice(0, 3);
  const signal = AbortSignal.timeout(TIMEOUTS.predict);
  let usage = { inputTokens: 0, outputTokens: 0 };

  return withTrace("twin.ablate", async () => {
    const results = await Promise.all(
      targets.map(async (e) => {
        const without: TwinContext = { ...ctx, memories: ctx.memories.filter((m) => m.id !== e.id) };
        const agent = new Agent({
          name: "Ablation",
          model: models.fast,
          instructions: predictorInstructions(without, p.options),
          outputType: PredictionSample,
          modelSettings: { reasoning: { effort: "low" } },
        });
        const runs = await Promise.allSettled(
          Array.from({ length: ABLATION_K }, () => run(agent, `Scenario: ${p.scenario}`, { maxTurns: 1, signal })),
        );
        const choices: string[] = [];
        for (const r of runs) {
          if (r.status !== "fulfilled") continue;
          usage = { inputTokens: usage.inputTokens + r.value.state.usage.inputTokens, outputTokens: usage.outputTokens + r.value.state.usage.outputTokens };
          if (r.value.finalOutput) choices.push(r.value.finalOutput.choice);
        }
        if (choices.length === 0) return null;
        const after = voteDistribution(choices, p.options);
        return isPivotal(p, after, p.options) ? e.id : null;
      }),
    );
    return { pivotalIds: results.filter((x): x is string => x !== null), usage };
  });
}
