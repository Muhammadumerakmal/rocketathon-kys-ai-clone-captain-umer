import "server-only";
import { Agent, run, withTrace } from "@openai/agents";
import { ModelExtractedOptions, PredictionSample, type DecisionCategory, type Prediction } from "@/contracts";
import { assemblePrediction } from "./assemble";
import type { TwinContext } from "./context";
import { configureAgents, models, TIMEOUTS } from "./models";
import { OPTIONS_INSTRUCTIONS, PROMPT_VERSIONS, predictorInstructions, strangerInstructions } from "./prompts";

export const K_SAMPLES = 5;
export const K_DUEL = 3;

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

const addUsage = (a: Usage, b: { inputTokens: number; outputTokens: number }): Usage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
});

/** Deterministic permutation per sample index (varies evidence order → diversity, less position bias). */
export function sampleOrder(n: number, seed: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (seed === 0) return idx;
  let s = seed * 9301 + 49297;
  for (let i = n - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx;
}

export interface PredictInput {
  id: string;
  scenario: string;
  options: readonly string[];
  category: DecisionCategory;
  history: { n: number; hits: number };
  k?: number;
}

/** Plan §11.3: k personalized samples ∥ one stranger sample → app-computed prediction. */
export async function predict(ctx: TwinContext, input: PredictInput): Promise<{ prediction: Prediction; usage: Usage }> {
  configureAgents();
  const k = input.k ?? K_SAMPLES;
  const prompt = `Scenario: ${input.scenario}`;
  const signal = AbortSignal.timeout(TIMEOUTS.predict);

  return withTrace("twin.predict", async () => {
    const predictor = (i: number) =>
      new Agent({
        name: "Predictor",
        model: models.primary,
        instructions: predictorInstructions(ctx, input.options, sampleOrder(ctx.memories.length, i)),
        outputType: PredictionSample,
        modelSettings: { reasoning: { effort: models.effort } },
      });
    const stranger = new Agent({
      name: "StrangerBaseline",
      model: models.fast,
      instructions: strangerInstructions(input.options),
      outputType: PredictionSample,
      modelSettings: { reasoning: { effort: "low" } },
    });

    const [samples, baseline] = await Promise.all([
      Promise.allSettled(Array.from({ length: k }, (_, i) => run(predictor(i), prompt, { maxTurns: 1, signal }))),
      run(stranger, prompt, { maxTurns: 1, signal }),
    ]);

    let usage: Usage = addUsage({ inputTokens: 0, outputTokens: 0 }, baseline.state.usage);
    const valid: PredictionSample[] = [];
    for (const s of samples) {
      if (s.status !== "fulfilled") continue;
      usage = addUsage(usage, s.value.state.usage);
      if (s.value.finalOutput) valid.push(s.value.finalOutput);
    }

    const baselineChoice =
      baseline.finalOutput && input.options.includes(baseline.finalOutput.choice) ? baseline.finalOutput.choice : input.options[0]!;

    const prediction = assemblePrediction(valid, baselineChoice, {
      id: input.id,
      scenario: input.scenario,
      options: input.options,
      category: input.category,
      asOf: ctx.asOf,
      retrieved: ctx.evidence,
      history: input.history,
      contradicted: ctx.contradicted,
      k,
      promptVersion: PROMPT_VERSIONS.predict,
      model: models.primary,
    });
    return { prediction, usage };
  });
}

/** When the user gives no options, a FAST call proposes 2–4 (user can edit). */
export async function extractOptions(scenario: string) {
  configureAgents();
  const agent = new Agent({
    name: "OptionExtractor",
    model: models.fast,
    instructions: OPTIONS_INSTRUCTIONS,
    outputType: ModelExtractedOptions,
    modelSettings: { reasoning: { effort: "low" } },
  });
  const res = await run(agent, scenario, { maxTurns: 1, signal: AbortSignal.timeout(TIMEOUTS.fast) });
  if (!res.finalOutput) throw new Error("Could not extract options");
  return { ...res.finalOutput, usage: res.state.usage };
}
