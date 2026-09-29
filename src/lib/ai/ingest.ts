import "server-only";
import { run } from "@openai/agents";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateMemoryRequest, Memory, MemoryKind, MemorySource, RevisionVerdict } from "@/contracts";
import { getMemories, insertMemory, matchMemories, updateMemory } from "@/server/repos/memories";
import { createRevision } from "@/server/repos/revisions";
import { classifierAgent, revisionAgent } from "./agents";
import { embed } from "./embeddings";
import { looksLikeInjection } from "./guardrails";
import { configureAgents, TIMEOUTS } from "./models";
import { escapeData } from "./prompts/user-data";

/**
 * Memory ingestion + belief revision (plan §11.2). Never deletes or overwrites silently.
 *   duplicate   → don't insert; bump the existing memory's importance
 *   refines     → insert, link
 *   contradicts → insert active + open a memory_revisions row for the Inbox
 */

export interface IngestResult {
  memory: Memory | null;
  duplicateOf: string | null;
  contradictions: number;
  sensitive: boolean;
  flaggedInjection: boolean;
}

/** Strip control characters and collapse whitespace (validation already capped length). */
export function sanitizeContent(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export async function ingestMemory(
  sb: SupabaseClient,
  userId: string,
  req: CreateMemoryRequest,
  source: MemorySource = "manual",
): Promise<IngestResult> {
  configureAgents();
  const content = sanitizeContent(req.content);
  const flaggedInjection = looksLikeInjection(content);
  const signal = AbortSignal.timeout(TIMEOUTS.fast);

  // Sealed memories never reach a model: no classification, no embedding, no revision.
  if (req.influence === "sealed") {
    const memory = await insertMemory(sb, userId, {
      content,
      kind: req.kind ?? "episodic",
      sourceType: source,
      influence: "sealed",
      validFrom: req.validFrom,
    });
    return { memory, duplicateOf: null, contradictions: 0, sensitive: false, flaggedInjection };
  }

  const [classification, embedding] = await Promise.all([
    run(classifierAgent(), `<user_data>${escapeData(content)}</user_data>`, { maxTurns: 1, signal })
      .then((r) => r.finalOutput ?? null)
      .catch(() => null),
    embed(content),
  ]);

  const kind: MemoryKind = req.kind ?? classification?.kind ?? "semantic";
  // Prompt-injection-looking memories are stored but muted until the user reviews them.
  const influence = flaggedInjection ? "muted" : req.influence;

  // Compare with the top-5 similar, currently-true memories.
  const similar = (await matchMemories(sb, { queryText: content, embedding, limit: 5 })).filter((m) => m.score > 0);
  let judgements: { candidateId: string; verdict: RevisionVerdict; explanation: string }[] = [];
  if (similar.length > 0) {
    const prompt = [
      `NEW: <user_data>${escapeData(content)}</user_data>`,
      "CANDIDATES:",
      ...similar.map((m) => `<memory id="${m.id}">${escapeData(m.content)}</memory>`),
    ].join("\n");
    judgements = await run(revisionAgent(), prompt, { maxTurns: 1, signal })
      .then((r) => r.finalOutput?.judgements ?? [])
      .catch(() => []);
    const known = new Set(similar.map((m) => m.id));
    judgements = judgements.filter((j) => known.has(j.candidateId));
  }

  const duplicate = judgements.find((j) => j.verdict === "duplicate");
  if (duplicate) {
    const [existing] = await getMemories(sb, [duplicate.candidateId]);
    if (existing) await updateMemory(sb, existing.id, { importance: Math.min(1, existing.importance + 0.1) });
    return { memory: null, duplicateOf: duplicate.candidateId, contradictions: 0, sensitive: Boolean(classification?.sensitive), flaggedInjection };
  }

  const memory = await insertMemory(sb, userId, {
    content,
    summary: classification?.summary ?? null,
    kind,
    sourceType: source,
    importance: classification?.importance ?? 0.5,
    influence,
    validFrom: req.validFrom,
    embedding,
  });

  const toRevise = judgements.filter((j) => j.verdict === "contradicts" || j.verdict === "refines");
  await Promise.all(
    toRevise.map((j) =>
      createRevision(sb, userId, {
        newMemoryId: memory.id,
        oldMemoryId: j.candidateId,
        verdict: j.verdict as "contradicts" | "refines",
        explanation: j.explanation,
      }),
    ),
  );

  return {
    memory,
    duplicateOf: null,
    contradictions: toRevise.filter((j) => j.verdict === "contradicts").length,
    sensitive: Boolean(classification?.sensitive),
    flaggedInjection,
  };
}
