import "server-only";
import type {
  ActionProposal,
  DueCheckin,
  DuelRound,
  FocusBlockArgs,
  Memory,
  MemoryRevision,
  Prediction,
  ResolveRevisionRequest,
} from "@/contracts";
import { memories, revision } from "./fixtures";

export interface MockResolution {
  predictionId: string;
  category: Prediction["category"];
  confidence: number;
  actualChoice: string;
  twinCorrect: boolean;
  baselineCorrect: boolean;
}

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
  predictions: Prediction[];
  resolutions: MockResolution[];
  checkins: DueCheckin[];
  proposals: MockProposal[];
  audit: MockAuditEntry[];
  calendarConnected: boolean;
  threads: MockThread[];
}

export interface MockThread {
  id: string;
  title: string;
  createdAt: string;
  messages: { role: "user" | "twin"; text: string }[];
}

export interface MockProposal extends ActionProposal {
  userId: string;
  argsHash: string;
  args: FocusBlockArgs;
  result: Record<string, unknown> | null;
}

export interface MockAuditEntry {
  at: string;
  event: string;
  detail: string;
}

const g = globalThis as typeof globalThis & { __twinMock?: MockState };

export function mockState(): MockState {
  // Demo starts BEFORE the contradiction is resolved: the old "risky bets" memory is still open.
  g.__twinMock ??= {
    answers: new Map(),
    memories: memories.map((m) => (m.id === revision.oldMemory.id ? { ...m, validTo: null, supersededBy: null } : { ...m })),
    revisions: [revision],
    duelRounds: [],
    predictions: [],
    resolutions: [],
    checkins: [],
    proposals: [],
    audit: [],
    calendarConnected: false,
    threads: [],
  };
  return g.__twinMock;
}

export const mockAnswers = () => [...mockState().answers.values()];

/** Resolved history for one category (mirror of calibration_stats). */
export function mockCategoryHistory(category: Prediction["category"]) {
  const rs = mockState().resolutions.filter((r) => r.category === category);
  return { n: rs.length, hits: rs.filter((r) => r.twinCorrect).length };
}

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
