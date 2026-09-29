import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";

export const MemoryKind = z.enum(["episodic", "semantic", "procedural", "value", "goal"]);
export type MemoryKind = z.infer<typeof MemoryKind>;

/** active = used; muted = excluded from predictions; sealed = never sent to any model (F12). */
export const Influence = z.enum(["active", "muted", "sealed"]);
export type Influence = z.infer<typeof Influence>;

export const RevisionVerdict = z.enum(["new", "duplicate", "refines", "contradicts"]);
export type RevisionVerdict = z.infer<typeof RevisionVerdict>;

/** How the user resolves a contradiction in the Belief Revision Inbox (F4). */
export const RevisionResolution = z.enum(["update", "both_true", "old_wrong"]);
export type RevisionResolution = z.infer<typeof RevisionResolution>;

export const MemorySource = z.enum(["manual", "quiz", "feedback", "outcome", "import", "connector"]);
export type MemorySource = z.infer<typeof MemorySource>;

export const Memory = z.object({
  id: Uuid,
  content: z.string().max(4000),
  summary: z.string().nullable(),
  kind: MemoryKind,
  sourceType: MemorySource,
  importance: z.number().min(0).max(1),
  validFrom: IsoDateTime,
  validTo: IsoDateTime.nullable(),
  recordedAt: IsoDateTime,
  supersededBy: Uuid.nullable(),
  influence: Influence,
});
export type Memory = z.infer<typeof Memory>;

export const CreateMemoryRequest = z.object({
  content: z.string().trim().min(3).max(4000),
  kind: MemoryKind.optional(),
  influence: Influence.default("active"),
  /** When it became true in the user's life. Defaults to now. */
  validFrom: IsoDateTime.optional(),
});
export type CreateMemoryRequest = z.infer<typeof CreateMemoryRequest>;

export const UpdateMemoryRequest = z.object({
  content: z.string().trim().min(3).max(4000).optional(),
  kind: MemoryKind.optional(),
  influence: Influence.optional(),
  importance: z.number().min(0).max(1).optional(),
});
export type UpdateMemoryRequest = z.infer<typeof UpdateMemoryRequest>;

export const MemorySearchRequest = z.object({
  query: z.string().trim().min(1).max(500),
  asOf: IsoDateTime.optional(),
  limit: z.number().int().min(1).max(30).default(12),
});
export type MemorySearchRequest = z.infer<typeof MemorySearchRequest>;

/** A retrieved memory with its final app-side score (§9.2). */
export const RetrievedMemory = z.object({
  id: Uuid,
  content: z.string(),
  kind: MemoryKind,
  importance: z.number(),
  validFrom: IsoDateTime,
  score: z.number(),
});
export type RetrievedMemory = z.infer<typeof RetrievedMemory>;

/** A pending contradiction shown in the Belief Revision Inbox. */
export const MemoryRevision = z.object({
  id: Uuid,
  newMemory: Memory,
  oldMemory: Memory,
  verdict: RevisionVerdict,
  explanation: z.string(),
  resolution: RevisionResolution.nullable(),
  createdAt: IsoDateTime,
});
export type MemoryRevision = z.infer<typeof MemoryRevision>;

export const ResolveRevisionRequest = z.object({
  resolution: RevisionResolution,
  /** Needed for "both_true": the context in which each memory holds. */
  qualifiers: z
    .object({ newContext: z.string().max(200), oldContext: z.string().max(200) })
    .optional(),
});
export type ResolveRevisionRequest = z.infer<typeof ResolveRevisionRequest>;

// ---- Model-facing schemas (strict structured outputs: no optionals, no records) ----

export const ModelMemoryClassification = z.object({
  kind: MemoryKind,
  importance: z.number().min(0).max(1),
  summary: z.string().max(140),
  /** health / religion / politics / sexuality etc. → UI suggests sealing */
  sensitive: z.boolean(),
});
export type ModelMemoryClassification = z.infer<typeof ModelMemoryClassification>;

export const ModelRevisionClassification = z.object({
  judgements: z
    .array(
      z.object({
        candidateId: z.string(),
        verdict: RevisionVerdict,
        explanation: z.string().max(240),
      }),
    )
    .max(5),
});
export type ModelRevisionClassification = z.infer<typeof ModelRevisionClassification>;
