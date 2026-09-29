import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";
import { EvidenceRef } from "./prediction";

export const TwinChatRequest = z.object({
  chatId: Uuid.nullable().default(null),
  message: z.string().trim().min(1).max(4000),
  asOf: IsoDateTime.nullable().default(null),
});
export type TwinChatRequest = z.infer<typeof TwinChatRequest>;

/** Server-sent events emitted by /api/twin (see lib/ai/stream.ts). */
export const TwinStreamEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("meta"), chatId: Uuid }),
  z.object({ type: z.literal("text"), delta: z.string() }),
  z.object({ type: z.literal("evidence"), evidence: z.array(EvidenceRef) }),
  z.object({
    type: z.literal("approval_required"),
    proposalId: Uuid,
    token: z.string(),
    summary: z.string(),
  }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
  z.object({ type: z.literal("done") }),
]);
export type TwinStreamEvent = z.infer<typeof TwinStreamEvent>;
