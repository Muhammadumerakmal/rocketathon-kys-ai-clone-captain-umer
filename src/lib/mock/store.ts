import "server-only";
import type { DuelRound, Memory, MemoryRevision, ResolveRevisionRequest } from "@/contracts";
import { duelRound, memories, revision } from "./fixtures";

/**
 * In-process state for TWIN_MOCK=1 so the demo is interactive without a database.
 * Lives on globalThis so dev hot-reload doesn't wipe it. Resets on server restart;
 * per-instance on serverless (fine for a demo).
 */
interface MockState {
  answers: Map<string, { questionId: string; optionId: string; attempt: 1 | 2 }>;
  memories: Memory[];
  revisions: MemoryRevision[];
  duelRounds: DuelRound[];
}

const g = globalThis as typeof globalThis & { __twinMock?: MockState };

export function mockState(): MockState {
  // Demo starts BEFORE the contradiction is resolved: the old "risky bets" memory is still open.
  g.__twinMock ??= {
    answers: new Map(),
    memories: memories.map((m) => (m.id === revision.oldMemory.id ? { ...m, validTo: null, supersededBy: null } : { ...m })),
    revisions: [revision],
    duelRounds: [duelRound],
  };
  return g.__twinMock;
}

export const mockAnswers = () => [...mockState().answers.values()];

/** Same semantics as lib/memory/resolve.ts, applied to the in-memory store. */
export function mockResolveRevision(id: string, req: ResolveRevisionRequest): boolean {
  const s = mockState();
  const rev = s.revisions.find((r) => r.id === id);
  if (!rev) return false;
  const patch = (memId: string, p: Partial<Memory>) => {
    s.memories = s.memories.map((m) => (m.id === memId ? { ...m, ...p } : m));
  };
  if (req.resolution === "update") patch(rev.oldMemory.id, { validTo: rev.newMemory.validFrom, supersededBy: rev.newMemory.id });
  if (req.resolution === "old_wrong") patch(rev.oldMemory.id, { influence: "muted" });
  if (req.resolution === "both_true" && req.qualifiers) {
    patch(rev.newMemory.id, { content: `${rev.newMemory.content} (${req.qualifiers.newContext})` });
    patch(rev.oldMemory.id, { content: `${rev.oldMemory.content} (${req.qualifiers.oldContext})` });
  }
  s.revisions = s.revisions.filter((r) => r.id !== id);
  return true;
}
