import "server-only";
import { Agent } from "@openai/agents";
import {
  CouncilSynthesis,
  LensView,
  ModelMemoryClassification,
  ModelRevisionClassification,
  Simulation,
  type Lens,
} from "@/contracts";
import type { TwinContext } from "./context";
import { impersonationGuard, noFirstPersonClaimGuard } from "./guardrails";
import { models } from "./models";
import {
  CLASSIFY_INSTRUCTIONS,
  lensInstructions,
  REVISION_INSTRUCTIONS,
  simulatorInstructions,
  SYNTHESIS_INSTRUCTIONS,
  twinInstructions,
} from "./prompts";

/** Agent factories. No tools and no handoffs in the MVP: predictable cost, easy to trace. */

export function twinChatAgent(ctx: TwinContext) {
  return new Agent({
    name: "Twin",
    model: models.primary,
    instructions: twinInstructions(ctx),
    modelSettings: { reasoning: { effort: "low" } },
    inputGuardrails: [impersonationGuard],
    outputGuardrails: [noFirstPersonClaimGuard(ctx.twinName)],
  });
}

export const classifierAgent = () =>
  new Agent({
    name: "MemoryClassifier",
    model: models.fast,
    instructions: CLASSIFY_INSTRUCTIONS,
    outputType: ModelMemoryClassification,
    modelSettings: { reasoning: { effort: "low" } },
  });

export const revisionAgent = () =>
  new Agent({
    name: "BeliefReviser",
    model: models.fast,
    instructions: REVISION_INSTRUCTIONS,
    outputType: ModelRevisionClassification,
    modelSettings: { reasoning: { effort: "low" } },
  });

export const lensAgent = (ctx: TwinContext, lens: Lens, majority?: string) =>
  new Agent({
    name: `Lens:${lens.name}`,
    model: models.fast,
    instructions: lensInstructions(ctx, lens, majority),
    outputType: LensView,
    modelSettings: { reasoning: { effort: "low" } },
  });

export const synthesisAgent = () =>
  new Agent({
    name: "CouncilSynthesis",
    model: models.primary,
    instructions: SYNTHESIS_INSTRUCTIONS,
    outputType: CouncilSynthesis,
    modelSettings: { reasoning: { effort: models.effort } },
  });

export const simulatorAgent = (ctx: TwinContext) =>
  new Agent({
    name: "Simulator",
    model: models.primary,
    instructions: simulatorInstructions(ctx),
    outputType: Simulation,
    modelSettings: { reasoning: { effort: models.effort } },
  });
