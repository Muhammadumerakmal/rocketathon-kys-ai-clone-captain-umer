"use client";

import { m, useReducedMotion } from "motion/react";
import type { TraitScore } from "@/contracts";
import { springs } from "@/lib/motion/tokens";
import { TRAIT_POLES } from "@/lib/training/labels";
import { pct } from "@/lib/utils";

/**
 * Say vs Do (UI/UX plan §6.6, Blind Spot Mirror F6). Both markers describe YOU, so both are
 * ink (colour rule): filled = what you said in the quiz, hollow = what your real choices show.
 * On open the two markers slide apart from the centre to their values.
 */
export function SayVsDo({ stated, revealed }: { stated: TraitScore[]; revealed: TraitScore[] }) {
  const reduced = useReducedMotion();
  const rev = new Map(revealed.filter((r) => r.sampleCount > 0).map((r) => [r.trait, r]));
  const known = stated.filter((s) => s.sampleCount > 0);
  if (known.length === 0) return null;

  // SVG attribute animation (cx), not CSS left: transform/SVG only (plan §9)
  const slide = (value: number) =>
    reduced ? { cx: value * 100 } : { initial: { cx: 50 }, animate: { cx: value * 100 }, transition: springs.gentle };

  return (
    <figure className="space-y-4">
      <figcaption className="flex flex-wrap gap-4 text-xs text-muted" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-ink" /> What you said
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full ring-2 ring-inset ring-ink" /> What you did
        </span>
      </figcaption>
      <ul className="space-y-4">
        {known.map((s) => {
          const [lo, hi] = TRAIT_POLES[s.trait];
          const r = rev.get(s.trait);
          return (
            <li key={s.trait}>
              <div className="flex justify-between text-xs text-muted">
                <span>{lo}</span>
                <span>{hi}</span>
              </div>
              <svg viewBox="-6 0 112 12" className="mt-1.5 h-auto w-full overflow-visible" aria-hidden>
                <line x1={0} x2={100} y1={6} y2={6} stroke="var(--line)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                <m.circle cy={6} r={5} fill="var(--ink)" {...slide(s.score)} />
                {r && <m.circle cy={6} r={4} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} {...slide(r.score)} />}
              </svg>
              <p className="sr-only">
                {lo} to {hi}: you said {pct(s.score)}
                {r ? `, your real choices show ${pct(r.score)} across ${r.sampleCount} decisions` : ", no real choices yet"}.
              </p>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
