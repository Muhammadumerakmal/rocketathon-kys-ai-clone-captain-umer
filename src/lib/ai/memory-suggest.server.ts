import "server-only";
import { Agent, run } from "@openai/agents";
import type { MemorySuggestion } from "@/contracts";
import { configureAgents, models, TIMEOUTS } from "./models";
import { dedupeSuggestions, MEMORY_EXTRACT_INSTRUCTIONS, mightContainFact, ModelMemorySuggestions } from "./memory-suggest";
import { escapeData } from "./prompts/user-data";

/**
 * Ask the FAST model for 0–2 memory proposals. Best-effort: any failure means "no
 * suggestions" — it must never break or delay the chat reply.
 */
export async function suggestMemories(
  message: string,
  known: readonly string[],
): Promise<{ suggestions: MemorySuggestion[]; usage: { inputTokens: number; outputTokens: number } }> {
  const none = { suggestions: [], usage: { inputTokens: 0, outputTokens: 0 } };
  if (!mightContainFact(message)) return none;
  try {
    configureAgents();
    const agent = new Agent({
      name: "MemoryPicker",
      model: models.fast,
      instructions: MEMORY_EXTRACT_INSTRUCTIONS,
      outputType: ModelMemorySuggestions,
      modelSettings: { reasoning: { effort: "low" } },
    });
    const res = await run(agent, `<user_data>${escapeData(message)}</user_data>`, { maxTurns: 1, signal: AbortSignal.timeout(TIMEOUTS.fast) });
    return { suggestions: dedupeSuggestions(res.finalOutput?.suggestions ?? [], known), usage: res.state.usage };
  } catch (err) {
    console.warn("[memory-suggest] skipped", err instanceof Error ? err.message : err);
    return none;
  }
}
