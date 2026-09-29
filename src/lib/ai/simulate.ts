import "server-only";
import { run, withTrace } from "@openai/agents";
import type { Simulation } from "@/contracts";
import { simulatorAgent } from "./agents";
import type { TwinContext } from "./context";
import { configureAgents, TIMEOUTS } from "./models";

/** Keep only goal alignments that point at the user's real goals (model ids are untrusted). */
export function sanitizeSimulation(sim: Simulation, goalIds: ReadonlySet<string>): Simulation {
  const clean = (o: Simulation["optionA"]) => ({ ...o, goalAlignment: o.goalAlignment.filter((g) => goalIds.has(g.goalId)) });
  return { ...sim, optionA: clean(sim.optionA), optionB: clean(sim.optionB) };
}

/** Simulator v2 (plan §11.7): scenario simulation, not a forecast. */
export async function simulate(ctx: TwinContext, input: { optionA: string; optionB: string; context: string }) {
  configureAgents();
  return withTrace("twin.simulate", async () => {
    const prompt = [`Option A: ${input.optionA}`, `Option B: ${input.optionB}`, input.context && `Context: ${input.context}`].filter(Boolean).join("\n");
    const r = await run(simulatorAgent(ctx), prompt, { maxTurns: 1, signal: AbortSignal.timeout(TIMEOUTS.predict) });
    if (!r.finalOutput) throw new Error("Simulator returned nothing");
    const simulation = sanitizeSimulation(r.finalOutput, new Set(ctx.profile.goals.map((g) => g.id)));
    return { simulation, usage: r.state.usage };
  });
}
