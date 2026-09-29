import { z } from "zod";
import { DecisionCategory, Uuid } from "./common";

export const DuelScenario = z.object({
  id: z.string(),
  scenario: z.string(),
  options: z.array(z.string()).min(2).max(4),
  category: DecisionCategory,
});
export type DuelScenario = z.infer<typeof DuelScenario>;

/** The user's secret pick is submitted before anything is revealed. */
export const DuelRoundRequest = z.object({
  scenarioId: z.string(),
  userChoice: z.string().min(1),
});
export type DuelRoundRequest = z.infer<typeof DuelRoundRequest>;

export const DuelRound = z.object({
  id: Uuid,
  scenario: DuelScenario,
  userChoice: z.string(),
  twinChoice: z.string(),
  twinDistribution: z.record(z.string(), z.number()),
  baselineChoice: z.string(),
  twinMatched: z.boolean(),
  baselineMatched: z.boolean(),
});
export type DuelRound = z.infer<typeof DuelRound>;

export const DuelScoreboard = z.object({
  rounds: z.number().int().min(0),
  twinHits: z.number().int().min(0),
  baselineHits: z.number().int().min(0),
  /** twin accuracy − stranger accuracy, in percentage points */
  liftPts: z.number(),
});
export type DuelScoreboard = z.infer<typeof DuelScoreboard>;
