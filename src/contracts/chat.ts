import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";
import { MemoryKind } from "./memory";
import { EvidenceRef, Prediction } from "./prediction";

export const TwinChatRequest = z.object({
  chatId: Uuid.nullable().default(null),
  message: z.string().trim().min(1).max(4000),
  asOf: IsoDateTime.nullable().default(null),
});
export type TwinChatRequest = z.infer<typeof TwinChatRequest>;

/** A durable fact the twin noticed in chat. Proposed only — saved when the user taps Save. */
export const MemorySuggestion = z.object({
  content: z.string().min(3).max(300),
  kind: MemoryKind,
});
export type MemorySuggestion = z.infer<typeof MemorySuggestion>;

/** Model-facing: extract 0–2 durable first-person facts from one user message. */
export const ModelMemorySuggestions = z.object({
  suggestions: z.array(MemorySuggestion).max(2),
});

/** Real pipeline steps, never timers (UI/UX plan §6.4). */
export const StatusStep = z.enum(["retrieving", "sampling", "baseline"]);
export type StatusStep = z.infer<typeof StatusStep>;

const StatusEvent = z.object({
  type: z.literal("status"),
  step: StatusStep,
  done: z.number().int().min(0).optional(),
  total: z.number().int().min(1).optional(),
});

/** Server-sent events emitted by /api/twin (see lib/ai/stream.ts). */
export const TwinStreamEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("meta"), chatId: Uuid }),
  StatusEvent,
  z.object({ type: z.literal("text"), delta: z.string() }),
  z.object({ type: z.literal("evidence"), evidence: z.array(EvidenceRef) }),
  z.object({
    type: z.literal("approval_required"),
    proposalId: Uuid,
    token: z.string(),
    summary: z.string(),
  }),
  z.object({ type: z.literal("memory_suggestion"), suggestions: z.array(MemorySuggestion).min(1).max(2) }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
  z.object({ type: z.literal("done") }),
]);
export type TwinStreamEvent = z.infer<typeof TwinStreamEvent>;

/** Server-sent events emitted by /api/predict/stream. */
export const PredictStreamEvent = z.discriminatedUnion("type", [
  StatusEvent,
  z.object({ type: z.literal("prediction"), prediction: Prediction }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
  z.object({ type: z.literal("done") }),
]);
export type PredictStreamEvent = z.infer<typeof PredictStreamEvent>;
