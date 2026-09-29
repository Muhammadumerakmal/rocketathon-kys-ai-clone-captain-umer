"use client";

import { m, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Word-by-word blur-in (plan §3.3 "Prediction arrives"). Works for text that is still
 * streaming: already-shown words keep their keys, so only NEW words animate.
 * Plain text under reduced motion; screen readers always get the plain string.
 */
export function StreamedText({ text, className, stagger = 0.035 }: { text: string; className?: string; stagger?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return <span className={className}>{text}</span>;

  const words = text.split(/(\s+)/);
  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((w, i) =>
          /^\s+$/.test(w) ? (
            w
          ) : (
            <m.span
              key={i}
              className="inline-block"
              initial={{ opacity: 0, filter: "blur(6px)", y: 3 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 24) * stagger }}
            >
              {w}
            </m.span>
          ),
        )}
      </span>
    </span>
  );
}
