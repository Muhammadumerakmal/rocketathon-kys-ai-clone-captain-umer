import { z } from "zod";

export const Reversibility = z.enum(["two-way-door", "costly-to-reverse", "one-way-door"]);
export type Reversibility = z.infer<typeof Reversibility>;

/**
 * Model-facing. min(2) trade-offs + a failure mode per option are the optimism-bias guard (§11.4).
 * `goalId` is a plain string; app code drops ids that aren't the user's goals.
 */
export const SimulatedOption = z.object({
  label: z.string(),
  possibleUpsides: z.array(z.string()).min(2).max(5),
  possibleTradeoffs: z.array(z.string()).min(2).max(5),
  failureMode: z.string(),
  reversibility: Reversibility,
  goalAlignment: z.array(z.object({ goalId: z.string(), score: z.number().min(-1).max(1) })),
  /** "At 80, would you regret NOT doing this?" */
  regretCheck: z.string(),
});
export type SimulatedOption = z.infer<typeof SimulatedOption>;

export const Simulation = z.object({
  optionA: SimulatedOption,
  optionB: SimulatedOption,
  unknowns: z.array(z.string()).min(1),
  /** smallest test to reduce uncertainty */
  cheapestExperiment: z.string(),
});
export type Simulation = z.infer<typeof Simulation>;

export const SimulatorRequest = z.object({
  optionA: z.string().trim().min(2).max(300),
  optionB: z.string().trim().min(2).max(300),
  context: z.string().trim().max(1000).default(""),
});
export type SimulatorRequest = z.infer<typeof SimulatorRequest>;
