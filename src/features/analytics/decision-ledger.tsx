"use client";

import { m, useReducedMotion } from "motion/react";
import type { LedgerEntry } from "@/lib/analytics/ledger";
import { springs } from "@/lib/motion/tokens";

/**
 * Decision ledger (UI/UX plan §6.6): one dot pair per decision — twin on top, stranger below.
 * Filled = matched you, hollow = missed. Shape carries the result, so colour is never alone,
 * and every pair has a text label.
 */
export function DecisionLedger({ ledger }: { ledger: LedgerEntry[] }) {
  const reduced = useReducedMotion();
  if (ledger.length === 0) return null;

  return (
    <figure className="space-y-3">
      <ol className="flex flex-wrap gap-2" aria-label="Every decision, oldest first">
        {ledger.map((e, i) => (
          <m.li
            key={`${e.at}-${i}`}
            className="flex flex-col items-center gap-1 rounded-[var(--r-sm)] px-1 py-1.5"
            initial={reduced ? false : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...springs.bouncy, delay: Math.min(i, 30) * 0.04 }}
            title={e.scenario}
          >
            <Dot hit={e.twinCorrect} color="var(--chart-twin)" />
            <Dot hit={e.baselineCorrect} color="var(--chart-stranger)" />
            <span className="sr-only">
              Decision {i + 1}, {e.scenario}: twin {e.twinCorrect ? "matched you" : "missed"}, stranger {e.baselineCorrect ? "matched you" : "missed"}.
            </span>
          </m.li>
        ))}
      </ol>
      <figcaption className="flex flex-wrap gap-4 text-xs text-muted" aria-hidden>
        <span className="flex items-center gap-1.5">
          <Dot hit color="var(--chart-twin)" /> twin (top row)
        </span>
        <span className="flex items-center gap-1.5">
          <Dot hit color="var(--chart-stranger)" /> stranger (bottom row)
        </span>
        <span className="flex items-center gap-1.5">
          <Dot hit={false} color="var(--ink-3)" /> hollow = missed
        </span>
      </figcaption>
    </figure>
  );
}

function Dot({ hit, color }: { hit: boolean; color: string }) {
  return <span aria-hidden className="block size-3 rounded-full" style={hit ? { background: color } : { boxShadow: `inset 0 0 0 2px ${color}` }} />;
}
