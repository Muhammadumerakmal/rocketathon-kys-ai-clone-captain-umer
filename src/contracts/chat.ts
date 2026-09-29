import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";
import { MemoryCategory, MemoryUpdate } from "./memory";
import { EvidenceRef, Prediction } from "./prediction";

export const TwinChatRequest = z.object({
  chatId: Uuid.nullable().default(null),
  message: z.string().trim().min(1).max(4000),
  asOf: IsoDateTime.nullable().default(null),
});
export type TwinChatRequest = z.infer<typeof TwinChatRequest>;

/** A memory that actually informed an answer — shown behind "Personalized using your Twin" (spec §30). */
export const UsedMemory = z.object({
  id: Uuid,
  label: z.string().max(140),
  category: MemoryCategory,
  confidence: z.number().min(0).max(1),
});
export type UsedMemory = z.infer<typeof UsedMemory>;

/** Feedback on a personalized answer (spec §9): Exactly / Mostly right / Wrong (+ correction). */
export const AnswerFeedbackRequest = z.object({
  chatId: Uuid.nullable().default(null),
  answerExcerpt: z.string().min(1).max(1000),
  rating: z.enum(["exactly", "mostly", "wrong"]),
  correction: z.string().trim().max(1000).optional(),
  memoryIds: z.array(Uuid).max(12).default([]),
});
export type AnswerFeedbackRequest = z.infer<typeof AnswerFeedbackRequest>;

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
  z.object({ type: z.literal("personalized"), memories: z.array(UsedMemory).min(1).max(12) }),
  z.object({ type: z.literal("memory_update"), update: MemoryUpdate }),
  z.object({ type: z.literal("memory_update_failed"), message: z.string().max(200) }),
  z.object({ type: z.literal("answer_complete") }),
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
