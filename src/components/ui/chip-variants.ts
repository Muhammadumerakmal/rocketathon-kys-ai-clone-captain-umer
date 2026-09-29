import { cva } from "class-variance-authority";

/**
 * Chip styles (UI/UX plan §4), shared by server and client components (no "use client").
 * Tones follow the colour rule: neutral / you, twin = rose, stranger = champagne, ok / bad = outcomes.
 */
export const chipVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold", {
  variants: {
    tone: {
      neutral: "bg-surface-2 text-muted",
      you: "bg-ink text-paper",
      twin: "bg-twin-soft text-twin",
      stranger: "bg-stranger-soft text-stranger",
      ok: "bg-success-soft text-success",
      bad: "bg-danger-soft text-danger",
      warn: "bg-warning-soft text-warning",
    },
  },
  defaultVariants: { tone: "neutral" },
});
