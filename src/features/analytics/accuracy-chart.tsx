"use client";

import { m, useReducedMotion } from "motion/react";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import { cumulativeAccuracy, indexAt, linePath, type LedgerEntry } from "@/lib/analytics/ledger";
import { pct } from "@/lib/utils";

const W = 320;
const H = 140;

/**
 * Cumulative accuracy, twin (solid rose) vs stranger (dotted champagne) — UI/UX plan §6.6.
 * Draws in on first view; pointer scrub with a readout that is ALWAYS visible and is the
 * accessible alternative. touch-action: pan-y so scrubbing never fights page scroll.
 */
export function AccuracyChart({ ledger }: { ledger: LedgerEntry[] }) {
  const reduced = useReducedMotion();
  const series = useMemo(() => cumulativeAccuracy(ledger), [ledger]);
  const [active, setActive] = useState(series.length - 1);
  const box = useRef<SVGSVGElement>(null);
  const point = series[Math.min(active, series.length - 1)];

  function scrub(e: PointerEvent<SVGSVGElement>) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    setActive(indexAt(((e.clientX - rect.left) / rect.width) * W, W, series.length));
  }

  if (series.length === 0) return null;
  const x = (i: number) => (series.length === 1 ? W / 2 : (i / (series.length - 1)) * W);
  const draw = (delay: number) =>
    reduced ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] as const, delay } };

  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-muted" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-chart-twin" /> Your twin
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 border-t-2 border-dotted border-chart-stranger" /> A stranger
        </span>
      </div>

      <svg
        ref={box}
        viewBox={`-6 -6 ${W + 12} ${H + 12}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-label={`Accuracy over ${series.length} decisions: twin ${pct(series.at(-1)!.twin)}, stranger ${pct(series.at(-1)!.stranger)}`}
        onPointerMove={scrub}
        onPointerDown={scrub}
        onPointerLeave={() => setActive(series.length - 1)}
      >
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={0} x2={W} y1={(1 - v) * H} y2={(1 - v) * H} stroke="var(--line)" strokeWidth={1} />
            <text x={W} y={(1 - v) * H - 4} textAnchor="end" className="fill-faint text-[9px]">
              {pct(v)}
            </text>
          </g>
        ))}
        <m.path d={linePath(series.map((p) => p.stranger), W, H)} fill="none" stroke="var(--chart-stranger)" strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" {...draw(0.2)} />
        <m.path d={linePath(series.map((p) => p.twin), W, H)} fill="none" stroke="var(--chart-twin)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" {...draw(0)} />
        {point && (
          <g aria-hidden>
            <line x1={x(active)} x2={x(active)} y1={0} y2={H} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="2 3" />
            <circle cx={x(active)} cy={(1 - point.stranger) * H} r={4.5} fill="var(--surface)" stroke="var(--chart-stranger)" strokeWidth={2} />
            <circle cx={x(active)} cy={(1 - point.twin) * H} r={4.5} fill="var(--chart-twin)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
      </svg>

      {/* readout: always visible, and what screen readers use */}
      {point && (
        <figcaption className="text-sm" aria-live="polite">
          After decision {point.n}: your twin was right <strong className="text-twin">{pct(point.twin)}</strong> of the time, a stranger{" "}
          <strong className="text-stranger">{pct(point.stranger)}</strong>.
        </figcaption>
      )}
    </figure>
  );
}
