import "server-only";
import type { EvidenceRef, EvidenceType, Influence, MemoryKind } from "@/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { activeGoals } from "@/server/repos/goals";
import { matchMemories } from "@/server/repos/memories";
import { getProfile } from "@/server/repos/profiles";
import { contradictedMemoryIds } from "@/server/repos/revisions";
import { getTraits } from "@/server/repos/traits";
import { embed } from "./embeddings";
import type { ProfileInput } from "./prompts/profile";
import { rankMemories } from "./ranking";

/** Everything a twin agent may know for one request. Bounded (~6k tokens, plan §11.1). */
export interface ContextMemory {
  id: string;
  kind: MemoryKind;
  content: string;
  validFrom: string;
  importance: number;
  relevance: number;
}

export interface TwinContext {
  userId: string;
  twinName: string;
  asOf: string | null;
  memories: ContextMemory[];
  evidence: EvidenceRef[];
  profile: ProfileInput;
  contradicted: Set<string>;
}

const MAX_CONTEXT_CHARS = 12_000; // ≈ 3k tokens of memories, leaves room for profile + history

const EVIDENCE_TYPE: Record<MemoryKind, EvidenceType> = {
  episodic: "memory",
  semantic: "memory",
  procedural: "memory",
  value: "value",
  goal: "goal",
};

export function toEvidence(m: ContextMemory): EvidenceRef {
  const label = m.content.length > 140 ? `${m.content.slice(0, 137)}…` : m.content;
  return { id: m.id, type: EVIDENCE_TYPE[m.kind], label, relevance: Math.round(m.relevance * 1000) / 1000 };
}

/**
 * Final gate before anything reaches a prompt (F12 double protection): only `active`
 * memories pass, and total size is capped.
 */
export function promptSafeMemories<T extends ContextMemory & { influence?: Influence }>(items: readonly T[]): ContextMemory[] {
  const out: ContextMemory[] = [];
  let used = 0;
  for (const m of items) {
    if (m.influence !== undefined && m.influence !== "active") continue;
    if (used + m.content.length > MAX_CONTEXT_CHARS) break;
    used += m.content.length;
    out.push({ id: m.id, kind: m.kind, content: m.content, validFrom: m.validFrom, importance: m.importance, relevance: m.relevance });
  }
  return out;
}

export async function buildTwinContext(
  sb: SupabaseClient,
  userId: string,
  { query, asOf = null, limit = 12 }: { query: string; asOf?: string | null; limit?: number },
): Promise<TwinContext> {
  const embedding = await embed(query);
  const [rows, traits, goals, profile, contradicted] = await Promise.all([
    matchMemories(sb, { queryText: query, embedding, asOf, limit }),
    getTraits(sb),
    activeGoals(sb),
    getProfile(sb, userId),
    contradictedMemoryIds(sb),
  ]);

  const ranked = rankMemories(
    rows.map((r) => ({
      id: r.id,
      rrfScore: r.score,
      importance: r.importance,
      kind: r.kind,
      validFrom: new Date(r.valid_from),
    })),
    asOf ? new Date(asOf) : new Date(),
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const memories = promptSafeMemories(
    ranked.map((r) => {
      const row = byId.get(r.id)!;
      return {
        id: r.id,
        kind: r.kind,
        content: row.context_qualifier ? `${row.content} (${row.context_qualifier})` : row.content,
        validFrom: new Date(row.valid_from).toISOString(),
        importance: r.importance,
        relevance: r.relevance,
      };
    }),
  );

  return {
    userId,
    twinName: profile?.displayName ?? "the user",
    asOf,
    memories,
    evidence: memories.map(toEvidence),
    profile: { stated: traits.stated, revealed: traits.revealed, goals },
    contradicted,
  };
}
