import { z } from "zod";
import { DecisionCategory, IsoDateTime, OptionList, Uuid } from "./common";
import { Confidence } from "./confidence";

export const EvidenceType = z.enum([
  "memory",
  "preference",
  "goal",
  "value",
  "decision",
  "feedback",
  "outcome",
]);
export type EvidenceType = z.infer<typeof EvidenceType>;

export const EvidenceRef = z.object({
  id: Uuid,
  type: EvidenceType,
  label: z.string().max(140),
  /** retrieval score, app-computed */
  relevance: z.number().min(0).max(1),
  /** set by counterfactual ablation (F3) */
  pivotal: z.boolean().optional(),
});
export type EvidenceRef = z.infer<typeof EvidenceRef>;

/**
 * What the MODEL returns for one sample. Strict-structured-output friendly.
 * `citedEvidenceIds` are plain strings: app code drops any id that was not retrieved.
 */
export const PredictionSample = z.object({
  choice: z.string(),
  rationale: z.array(z.string()).max(4),
  citedEvidenceIds: z.array(z.string()).max(6),
  /** what would change its mind */
  missingInfo: z.array(z.string()).max(3),
});
export type PredictionSample = z.infer<typeof PredictionSample>;

/** Samples whose `choice` isn't one of the options are discarded (plan §11.3). */
export const sampleForOptions = (options: readonly string[]) =>
  PredictionSample.refine((s) => options.includes(s.choice), {
    message: "choice must be one of the options",
    path: ["choice"],
  });

export const PredictRequest = z.object({
  scenario: z.string().trim().min(5).max(1000),
  /** If omitted, a FAST call extracts 2–4 options first. */
  options: OptionList.optional(),
  category: DecisionCategory.default("other"),
  /** Time-Travel Twin (F5): answer as the user was at this moment. */
  asOf: IsoDateTime.nullable().default(null),
});
export type PredictRequest = z.infer<typeof PredictRequest>;

export const PredictionStatus = z.enum(["open", "resolved"]);

/** What the APP stores and returns. */
export const Prediction = z.object({
  id: Uuid,
  scenario: z.string(),
  options: z.array(z.string()).min(2).max(5),
  category: DecisionCategory,
  /** option -> vote share across k samples; sums to 1 */
  distribution: z.record(z.string(), z.number().min(0).max(1)),
  topChoice: z.string(),
  baseline: z.object({ choice: z.string(), agreesWithTwin: z.boolean() }),
  evidence: z.array(EvidenceRef),
  rationale: z.array(z.string()).max(4),
  missingInfo: z.array(z.string()).max(3),
  confidence: Confidence,
  /** "confident but under-informed": unanimous samples + thin evidence (§11.4) */
  underInformed: z.boolean(),
  asOf: IsoDateTime.nullable(),
  status: PredictionStatus,
  promptVersion: z.string(),
  model: z.string(),
  createdAt: IsoDateTime,
});
export type Prediction = z.infer<typeof Prediction>;

export const FeedbackVerdict = z.enum(["correct", "partial", "wrong"]);
export type FeedbackVerdict = z.infer<typeof FeedbackVerdict>;

export const FeedbackRequest = z.object({
  predictionId: Uuid,
  verdict: FeedbackVerdict,
  actualChoice: z.string().trim().min(1).max(200),
  note: z.string().max(1000).optional(),
});
export type FeedbackRequest = z.infer<typeof FeedbackRequest>;

/** Model-facing: extract options when the user gave none. */
export const ModelExtractedOptions = z.object({
  options: z.array(z.string().max(120)).min(2).max(4),
  category: DecisionCategory,
});
export type ModelExtractedOptions = z.infer<typeof ModelExtractedOptions>;
