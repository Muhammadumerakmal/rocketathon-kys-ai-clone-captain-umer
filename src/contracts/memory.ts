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

export const MemorySource = z.enum(["manual", "quiz", "training", "conversation", "explicit", "feedback", "outcome", "import", "connector"]);
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
  category: z.lazy(() => MemoryCategory).default("other"),
  key: z.string().nullable().default(null),
  /** 0..1 — rises with repetition/confirmation, falls with contradiction (spec §7) */
  confidence: z.number().min(0).max(1).default(0.6),
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

/** What part of life a memory is about (Human AI Twin spec §18). Mirrors the DB check. */
export const MemoryCategory = z.enum([
  "coding",
  "career",
  "study",
  "goals",
  "food",
  "travel",
  "communication",
  "work_style",
  "entertainment",
  "health",
  "money",
  "relationships",
  "other",
]);
export type MemoryCategory = z.infer<typeof MemoryCategory>;

/** snake_case key, e.g. "hackathon_frontend" — one current value per (category, key). */
export const MemoryKey = z.string().regex(/^[a-z0-9_]{2,60}$/);

/**
 * Model-facing: what one user message teaches the twin (spec §5–§8, §26). Validated
 * server-side before anything touches the database — never inserted blindly.
 * durability separates "I want pizza today" (temporary) from "I generally love spicy food".
 */
export const ModelLearning = z.object({
  signals: z
    .array(
      z.object({
        category: MemoryCategory,
        key: z.string().max(60),
        value: z.string().max(120),
        /** first-person sentence, e.g. "For hackathons I prefer Vite because it's faster." */
        statement: z.string().max(200),
        kind: MemoryKind,
        durability: z.enum(["temporary", "long_term"]),
        /** explicit = "remember that…"/"I always…"; stated = plain first-person claim; inferred = implied */
        strength: z.enum(["explicit", "stated", "inferred"]),
      }),
    )
    .max(3),
  /** "Forget my React preference" → short descriptions of what to remove */
  forget: z.array(z.string().max(200)).max(3),
});
export type ModelLearning = z.infer<typeof ModelLearning>;
export type LearnedSignal = ModelLearning["signals"][number];

/** What changed in the twin after a message — shown only when it matters (spec §29). */
export const MemoryUpdate = z.object({
  explicit: z.boolean(),
  saved: z.array(z.string()),
  reinforced: z.array(z.string()),
  replaced: z.array(z.object({ from: z.string(), to: z.string() })),
  forgotten: z.array(z.string()),
});
export type MemoryUpdate = z.infer<typeof MemoryUpdate>;

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
