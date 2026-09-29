import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";

export const OutcomeCheckin = z.object({
  predictionId: Uuid,
  actualChoice: z.string().trim().min(1).max(200),
  satisfaction: z.number().int().min(1).max(5),
  regret: z.boolean(),
  surprise: z.string().max(500).optional(),
});
export type OutcomeCheckin = z.infer<typeof OutcomeCheckin>;

export const DueCheckin = z.object({
  id: Uuid,
  predictionId: Uuid,
  scenario: z.string(),
  topChoice: z.string(),
  dueAt: IsoDateTime,
});
export type DueCheckin = z.infer<typeof DueCheckin>;
