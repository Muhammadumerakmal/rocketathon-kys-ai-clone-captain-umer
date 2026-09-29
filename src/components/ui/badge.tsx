import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { chipVariants } from "./chip-variants";

/**
 * Legacy name kept for existing screens; maps old tones onto Chip's colour-rule tones.
 * New code should use <Chip>.
 */
const TONE = { neutral: "neutral", twin: "twin", success: "ok", warning: "warn", danger: "bad" } as const;

export function Badge({ className, tone = "neutral", ...props }: ComponentProps<"span"> & { tone?: keyof typeof TONE }) {
  return <span className={cn(chipVariants({ tone: TONE[tone] }), "text-xs", className)} {...props} />;
}
