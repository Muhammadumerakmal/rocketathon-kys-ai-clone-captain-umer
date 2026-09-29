import { z } from "zod";
import { DecisionCategory, Uuid } from "./common";

/**
 * The eight Decision DNA dimensions. Scores are 0..1 where 1 = the named pole.
 * Includes "irrational" habits on purpose: guards against the over-rational twin (§11.4).
 */
export const TraitKey = z.enum([
  "risk_tolerance",
  "opportunity_over_stability",
  "gut_over_analysis",
  "long_term_focus",
  "social_influence",
  "procrastination",
  "independence",
  "frugality",
]);
export type TraitKey = z.infer<typeof TraitKey>;

export const TraitSource = z.enum(["stated", "revealed"]);
export type TraitSource = z.infer<typeof TraitSource>;

/** Per option: signed nudges per trait, each in [-1, 1]. */
export const TraitWeights = z.partialRecord(TraitKey, z.number().min(-1).max(1));
export type TraitWeights = z.infer<typeof TraitWeights>;

export const TrainingOption = z.object({
  id: z.string(),
  label: z.string(),
  weights: TraitWeights,
});
export type TrainingOption = z.infer<typeof TrainingOption>;

export const TrainingQuestion = z.object({
  id: Uuid,
  slug: z.string(),
  question: z.string(),
  category: DecisionCategory,
  options: z.array(TrainingOption).min(2).max(5),
  isRetest: z.boolean(),
});
export type TrainingQuestion = z.infer<typeof TrainingQuestion>;

export const TrainingAnswerRequest = z.object({
  questionId: Uuid,
  optionId: z.string(),
  attempt: z.union([z.literal(1), z.literal(2)]).default(1),
});
export type TrainingAnswerRequest = z.infer<typeof TrainingAnswerRequest>;

export const TraitScore = z.object({
  trait: TraitKey,
  score: z.number().min(0).max(1),
  sampleCount: z.number().int().min(0),
  source: TraitSource,
});
export type TraitScore = z.infer<typeof TraitScore>;
