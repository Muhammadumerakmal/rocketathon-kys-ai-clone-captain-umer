import { z } from "zod";
import { Uuid } from "./common";

export const LensKind = z.enum(["goal", "devils_advocate"]);

export const Lens = z.object({
  id: z.string(),
  name: z.string().max(60),
  kind: LensKind,
  goalId: Uuid.nullable(),
  rubric: z.string().max(400),
});
export type Lens = z.infer<typeof Lens>;

/** Model-facing: the view from one lens. */
export const LensView = z.object({
  stance: z.string().max(280),
  topReasons: z.array(z.string().max(200)).min(1).max(3),
  riskFlagged: z.string().max(200),
});
export type LensView = z.infer<typeof LensView>;

/**
 * Model-facing synthesis. `.strict()` means an extra `finalDecision` key fails
 * validation: the council maps trade-offs, it never decides (plan §11.6).
 */
export const CouncilSynthesis = z
  .object({
    agreementPoints: z.array(z.string().max(200)).max(4),
    tradeoffs: z
      .array(z.object({ between: z.string().max(120), tension: z.string().max(240) }))
      .max(4),
    questionsForYou: z.array(z.string().max(200)).length(3),
  })
  .strict();
export type CouncilSynthesis = z.infer<typeof CouncilSynthesis>;

export const CouncilRequest = z.object({
  question: z.string().trim().min(5).max(1000),
});
export type CouncilRequest = z.infer<typeof CouncilRequest>;

export const CouncilResult = z.object({
  question: z.string(),
  views: z.array(z.object({ lens: Lens, view: LensView })).min(2).max(5),
  synthesis: CouncilSynthesis,
});
export type CouncilResult = z.infer<typeof CouncilResult>;
