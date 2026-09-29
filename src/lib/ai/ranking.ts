import type { MemoryKind, MemorySource } from "@/contracts";

/**
 * App-side ranking on top of the `match_memories` RRF score (plan §9.2):
 *   final = rrfScore × (0.7 + 0.3·importance) × recencyDecay(valid_from)
 * Recency is off for `value` / `procedural` memories, which don't go stale.
 */

export const DEFAULT_RRF_K = 50;
const DAY_MS = 86_400_000;

/**
 * Reciprocal Rank Fusion of several ranked id lists (pure mirror of the SQL,
 * used by mock mode and tests). Ranks are 1-based.
 */
export function rrfMerge(lists: readonly (readonly string[])[], k = DEFAULT_RRF_K): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, i) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1)));
  }
  return scores;
}

const NON_DECAYING: ReadonlySet<MemoryKind> = new Set(["value", "procedural"]);

/** Exponential half-life decay, floored so old-but-true memories still count. */
export function recencyDecay(
  validFrom: Date,
  kind: MemoryKind,
  { now = new Date(), halfLifeDays = 180, floor = 0.35 } = {},
): number {
  if (NON_DECAYING.has(kind)) return 1;
  const ageDays = Math.max(0, (now.getTime() - validFrom.getTime()) / DAY_MS);
  return floor + (1 - floor) * 0.5 ** (ageDays / halfLifeDays);
}

export interface RankInput {
  id: string;
  rrfScore: number;
  importance: number;
  kind: MemoryKind;
  validFrom: Date;
  /** 0..1 — how sure the twin is about this memory (Human AI Twin spec §7). Default 1. */
  confidence?: number;
  /** where it came from: explicit statements and corrections outrank inferences (spec §11) */
  source?: MemorySource;
}

export interface Ranked extends RankInput {
  score: number;
  /** score normalized to 0..1 against the best hit — used as EvidenceRef.relevance */
  relevance: number;
}

/** Explicit statements and corrections carry more weight than inferred ones. */
export function sourceWeight(source: MemorySource | undefined): number {
  return source === "explicit" || source === "feedback" ? 1.15 : 1;
}

/**
 * Final ordering. `now` is the as-of moment for Time-Travel Twin, so recency is
 * measured from the date being asked about, not from today.
 */
export function rankMemories(items: readonly RankInput[], now = new Date()): Ranked[] {
  const scored = items.map((m) => ({
    ...m,
    score:
      m.rrfScore *
      (0.7 + 0.3 * m.importance) *
      recencyDecay(m.validFrom, m.kind, { now }) *
      (0.5 + 0.5 * (m.confidence ?? 1)) *
      sourceWeight(m.source),
  }));
  const max = Math.max(0, ...scored.map((s) => s.score));
  return scored
    .map((s) => ({ ...s, relevance: max > 0 ? s.score / max : 0 }))
    .sort((a, b) => b.score - a.score);
}
