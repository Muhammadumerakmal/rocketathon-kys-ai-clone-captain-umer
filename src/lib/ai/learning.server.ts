import "server-only";
import { Agent, run } from "@openai/agents";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ModelLearning, type MemoryUpdate } from "@/contracts";
import { adjustConfidence, closeMemory, findCurrentPreference, insertMemory, matchMemories } from "@/server/repos/memories";
import { embed } from "./embeddings";
import { CONFIDENCE, LEARNING_INSTRUCTIONS, planUpsert, sourceFor, validateSignals } from "./learning";
import { configureAgents, models, TIMEOUTS } from "./models";
import { escapeData } from "./prompts/user-data";

/** How similar a stored memory must be to a "forget X" request before we remove it. */
const FORGET_SIMILARITY = 0.45;

export const emptyUpdate = (): MemoryUpdate => ({ explicit: false, saved: [], reinforced: [], replaced: [], forgotten: [] });

/** Ask the FAST model what this message teaches the twin. Best-effort: failure = learn nothing. */
export async function extractLearning(
  message: string,
  /** existing "category.key" pairs, so the same preference keeps the same key (supersession needs it) */
  knownKeys: readonly string[] = [],
): Promise<{ learning: ModelLearning; usage: { inputTokens: number; outputTokens: number } }> {
  const none = { learning: { signals: [], forget: [] }, usage: { inputTokens: 0, outputTokens: 0 } };
  if (message.trim().length < 8) return none;
  try {
    configureAgents();
    const agent = new Agent({
      name: "TwinLearner",
      model: models.fast,
      instructions: LEARNING_INSTRUCTIONS,
      outputType: ModelLearning,
      modelSettings: { reasoning: { effort: "low" } },
    });
    const keys = knownKeys.length ? `\nExisting preference keys (REUSE one when the message is about the same thing): ${knownKeys.slice(0, 60).join(", ")}` : "";
    const res = await run(agent, `<user_data>${escapeData(message)}</user_data>${keys}`, { maxTurns: 1, signal: AbortSignal.timeout(TIMEOUTS.fast) });
    return { learning: res.finalOutput ?? none.learning, usage: res.state.usage };
  } catch (err) {
    console.warn("[learning] extraction skipped", err instanceof Error ? err.message : err);
    return none;
  }
}

/**
 * Apply validated learning to the user's twin (spec §5–§8, §12, §43). Every write is scoped
 * by RLS to the signed-in user. Nothing the model said is inserted without validation.
 */
export async function applyLearning(
  sb: SupabaseClient,
  userId: string,
  learning: ModelLearning,
  via: "conversation" | "feedback" | "training",
  evidence: string,
): Promise<MemoryUpdate> {
  const update = emptyUpdate();
  const signals = validateSignals(learning.signals);
  update.explicit = signals.some((s) => s.explicit) || learning.forget.length > 0 || via === "feedback";

  for (const signal of signals) {
    const existing = await findCurrentPreference(sb, signal.category, signal.key);
    const plan = planUpsert(
      via === "feedback" ? { ...signal, explicit: true, confidence: CONFIDENCE.feedback } : signal,
      existing
        ? {
            id: existing.id,
            // the normalized value is stored on evidence's first line (see insert below)
            value: existing.evidence?.split("\n")[0] ?? null,
            content: existing.content,
            confidence: existing.confidence,
            sourceType: existing.source_type,
          }
        : null,
    );
    if (plan.action === "skip") continue;
    if (plan.action === "reinforce") {
      await adjustConfidence(sb, [plan.id], plan.delta);
      update.reinforced.push(signal.statement);
      continue;
    }
    // supersede: close the old value FIRST (one current value per key is a DB constraint)
    if (plan.action === "supersede" && existing) await closeMemory(sb, existing.id);
    const saved = await insertMemory(sb, userId, {
      content: signal.statement,
      kind: signal.kind,
      sourceType: sourceFor(signal, via),
      importance: signal.confidence,
      category: signal.category,
      key: signal.key,
      confidence: via === "feedback" ? CONFIDENCE.feedback : signal.confidence,
      // the normalized value lives in `evidence`'s first line so repeats can be matched later
      evidence: `${signal.value}\n${evidence}`.slice(0, 500),
      embedding: await embed(signal.statement),
    });
    if (plan.action === "supersede" && existing) {
      await closeMemory(sb, existing.id, saved.id);
      update.replaced.push({ from: existing.content, to: signal.statement });
    } else {
      update.saved.push(signal.statement);
    }
  }

  // "Forget my React preference": remove the closest matching memories (spec §43).
  for (const what of learning.forget) {
    const hits = await matchMemories(sb, { queryText: what, embedding: await embed(what), limit: 3, minSimilarity: FORGET_SIMILARITY });
    for (const h of hits) {
      const { error } = await sb.from("memories").delete().eq("id", h.id);
      if (!error) update.forgotten.push(h.content);
    }
  }
  return update;
}
