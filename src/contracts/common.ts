import { z } from "zod";

/** ISO-8601 timestamp with offset, e.g. 2026-09-29T10:00:00Z. */
export const IsoDateTime = z.iso.datetime({ offset: true });

export const Uuid = z.uuid();

/** Decision categories. Calibration and history (§12 `H`) are tracked per category. */
export const DecisionCategory = z.enum([
  "career",
  "money",
  "health",
  "relationships",
  "learning",
  "lifestyle",
  "other",
]);
export type DecisionCategory = z.infer<typeof DecisionCategory>;

/** Uniform error body returned by every API route. */
export const ApiError = z.object({
  error: z.object({
    code: z.enum([
      "bad_request",
      "unauthorized",
      "forbidden",
      "not_found",
      "rate_limited",
      "budget_exceeded",
      "upstream_timeout",
      "guardrail_blocked",
      "internal",
    ]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

/** 2–5 distinct, trimmed, non-empty option labels. */
export const OptionList = z
  .array(z.string().trim().min(1).max(200))
  .min(2)
  .max(5)
  .refine((opts) => new Set(opts.map((o) => o.toLowerCase())).size === opts.length, {
    message: "Options must be distinct",
  });
