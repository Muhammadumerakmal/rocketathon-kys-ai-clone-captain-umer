import "server-only";
import { setDefaultOpenAIKey, setTracingDisabled } from "@openai/agents";
import OpenAI from "openai";
import { env } from "@/lib/env";

/**
 * Model tiers (plan §4): PRIMARY for chat / prediction / synthesis,
 * FAST for stranger baseline, ablation, classification.
 */
let configured = false;

/** Idempotent SDK setup. Call at the top of every live AI entry point. */
export function configureAgents() {
  if (configured) return;
  const e = env();
  if (e.OPENAI_API_KEY) setDefaultOpenAIKey(e.OPENAI_API_KEY);
  if (process.env.OPENAI_AGENTS_DISABLE_TRACING === "1") setTracingDisabled(true);
  configured = true;
}

export const models = {
  get primary() {
    return env().TWIN_MODEL_PRIMARY;
  },
  get fast() {
    return env().TWIN_MODEL_FAST;
  },
  get embedding() {
    return env().OPENAI_EMBEDDING_MODEL;
  },
  /** Measured on gpt-5: medium ≈ 26 s per prediction; see evals/smoke for current numbers. */
  get effort() {
    return env().TWIN_REASONING_EFFORT;
  },
};

let openai: OpenAI | undefined;

/** Plain OpenAI client, used only for embeddings (the Agents SDK doesn't embed). */
export function openaiClient(): OpenAI {
  openai ??= new OpenAI({ apiKey: env().OPENAI_API_KEY, timeout: 20_000, maxRetries: 2 });
  return openai;
}

/** Per-call timeouts (rule 11). */
export const TIMEOUTS = {
  chat: 45_000,
  predict: 40_000,
  fast: 20_000,
} as const;
