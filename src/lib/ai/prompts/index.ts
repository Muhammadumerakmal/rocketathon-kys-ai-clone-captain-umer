import type { Lens } from "@/contracts";
import type { TwinContext } from "../context";
import { profileBlock } from "./profile";
import { escapeData, INJECTION_BOUNDARY, memoryBlock } from "./user-data";

/**
 * All prompts live here (rule 6). Bump a version whenever its text changes;
 * versions are stored on predictions so eval deltas are attributable.
 */
export const PROMPT_VERSIONS = {
  twin: "twin@1",
  predict: "predict@1",
  stranger: "stranger@1",
  classify: "classify@1",
  revision: "revision@1",
  options: "options@1",
  council: "council@1",
  simulator: "simulator@1",
} as const;

const identity = (ctx: TwinContext) =>
  `You are TwinOS, an AI model of ${escapeData(ctx.twinName)}'s stated patterns. You are NOT ${escapeData(ctx.twinName)} and never claim to be. ` +
  "The user is always the final decision-maker.";

const honesty =
  "Speak as \"Based on what you've told me…\". If the evidence below is thin or unrelated, say \"I don't know you well enough on this yet\" " +
  "and ask one question that would help. Never invent memories, events, people or preferences that are not in <user_data>.";

const timeframe = (ctx: TwinContext) =>
  ctx.asOf
    ? `TIME-TRAVEL MODE: answer as the user was on ${ctx.asOf.slice(0, 10)}. Only the memories below were true then.`
    : "";

/** Layers 1–5 of plan §11.1. Conversation history is added by the Session. */
export function twinInstructions(ctx: TwinContext): string {
  return [
    identity(ctx),
    honesty,
    INJECTION_BOUNDARY,
    timeframe(ctx),
    profileBlock(ctx.profile),
    "Relevant memories (most relevant first):",
    memoryBlock(ctx.memories),
    "Keep answers short and concrete. When you rely on a memory, paraphrase it; don't quote ids.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Personalized predictor. `order` shuffles evidence per sample: diversity for
 * reasoning models that ignore temperature, and less position bias (plan §11.3).
 */
export function predictorInstructions(ctx: TwinContext, options: readonly string[], order?: readonly number[]): string {
  const mems = order ? order.map((i) => ctx.memories[i]).filter((m) => m !== undefined) : ctx.memories;
  return [
    identity(ctx),
    INJECTION_BOUNDARY,
    timeframe(ctx),
    "Task: predict which option THIS person would actually choose — not what is objectively best, not what an average person would do.",
    "Model their real habits, including impulsive, inconsistent or irrational ones. Do not use stereotypes about any group.",
    profileBlock(ctx.profile),
    memoryBlock(mems),
    `Options (choose exactly one, copied verbatim): ${options.map((o) => JSON.stringify(o)).join(", ")}`,
    "Return: choice; up to 4 short rationale bullets phrased 'Based on what you've told me…'; " +
      "citedEvidenceIds = ids of the memories that actually drove the choice (only ids shown above); " +
      "missingInfo = up to 3 facts that would change your mind.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Stranger baseline: NO personal context, ever (F1). */
export function strangerInstructions(options: readonly string[]): string {
  return [
    "You are predicting what a typical adult would choose in the scenario. You know nothing about this specific person.",
    `Options (choose exactly one, copied verbatim): ${options.map((o) => JSON.stringify(o)).join(", ")}`,
    "Return citedEvidenceIds as an empty list.",
  ].join("\n\n");
}

export const CLASSIFY_INSTRUCTIONS = [
  "Classify a personal memory the user wrote about themselves.",
  "kind: episodic (a specific event), semantic (a fact about them), procedural (how they tend to act), value (what they care about), goal (what they want to achieve).",
  "importance 0..1: how much it should influence future decisions.",
  "summary: <= 12 words.",
  "sensitive: true if it concerns health, religion, politics, sexuality, or someone else's private information.",
  INJECTION_BOUNDARY,
].join("\n");

export const REVISION_INSTRUCTIONS = [
  "Compare a NEW memory with existing memories of the same person. For each candidate, judge:",
  "- duplicate: says the same thing",
  "- refines: adds detail or nuance, both can be true",
  "- contradicts: both cannot be true at the same time for this person (e.g. 'loves risk' vs 'now values stability')",
  "- new: unrelated",
  "Explain in one short sentence addressed to the user. Use each candidate's id exactly.",
  INJECTION_BOUNDARY,
].join("\n");

export const OPTIONS_INSTRUCTIONS =
  "Extract 2–4 distinct, mutually exclusive options the person is choosing between, each <= 8 words, and a category.";

export function lensInstructions(ctx: TwinContext, lens: Lens, majority?: string): string {
  const role =
    lens.kind === "devils_advocate"
      ? `You are the Devil's Advocate. Argue AGAINST the majority view${majority ? ` ("${escapeData(majority)}")` : ""}, honestly and specifically.`
      : `You are "${escapeData(lens.name)}", the part of the user focused on: ${escapeData(lens.rubric)}`;
  return [role, INJECTION_BOUNDARY, profileBlock(ctx.profile), memoryBlock(ctx.memories), "Give a stance, up to 3 reasons, and the main risk you see."].join("\n\n");
}

export const SYNTHESIS_INSTRUCTIONS = [
  "You synthesize a council of perspectives for a person's decision.",
  "Return agreement points, a trade-off map (which perspectives disagree and why) and exactly 3 questions for the person.",
  "NEVER make the decision or recommend a final option. The human decides.",
].join("\n");

export function simulatorInstructions(ctx: TwinContext): string {
  return [
    "Simulate two options for this person as a SCENARIO SIMULATION, not a forecast.",
    INJECTION_BOUNDARY,
    profileBlock(ctx.profile),
    memoryBlock(ctx.memories),
    "For each option: 2–5 possible upsides, 2–5 possible trade-offs, one realistic failure mode, reversibility, " +
      "goal alignment per goal id listed above (-1..1), and a regret-minimization question.",
    "Then list unknowns and the cheapest experiment that would reduce uncertainty. Be balanced: no option is all upside.",
  ].join("\n\n");
}
