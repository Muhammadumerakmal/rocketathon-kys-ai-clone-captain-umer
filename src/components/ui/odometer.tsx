"use client";

import { m, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Rolling digits (plan §3.3 "Duel reveal": score digits roll, 760 ms).
 * Screen readers get the plain number; the animated columns are aria-hidden.
 */
export function Odometer({ value, className }: { value: number; className?: string }) {
  const reduced = useReducedMotion();
  const text = String(Math.max(0, Math.round(value)));

  return (
    <span className={cn("relative inline-flex tabular-nums", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex overflow-hidden" style={{ height: "1em", lineHeight: 1 }}>
        {text.split("").map((ch, i) => (
          <span key={`${text.length}-${i}`} className="relative inline-block" style={{ width: "0.62em" }}>
            <m.span
              className="absolute left-0 top-0 flex flex-col"
              initial={false}
              animate={{ y: `${-Number(ch)}em` }}
              transition={reduced ? { duration: 0 } : { duration: 0.76, ease: [0.22, 1, 0.36, 1] }}
            >
              {DIGITS.map((d) => (
                <span key={d} style={{ height: "1em", lineHeight: 1 }}>
                  {d}
                </span>
              ))}
            </m.span>
          </span>
        ))}
      </span>
    </span>
  );
}
