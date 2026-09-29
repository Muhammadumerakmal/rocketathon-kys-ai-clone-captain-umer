"use client";

import { useState } from "react";
import type { TraitScore } from "@/contracts";
import type { ReliabilityBin } from "@/lib/ai/confidence";
import { cn, pct } from "@/lib/utils";

/** Legend chip: identity is carried by a colored mark beside text-colored ink, never by text color. */
function Key({ className, label, shape = "bar" }: { className: string; label: string; shape?: "bar" | "tick" }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span aria-hidden className={cn(shape === "bar" ? "h-2.5 w-2.5 rounded-sm" : "h-0.5 w-3", className)} />
      {label}
    </span>
  );
}

/**
 * Reliability chart (plan §12): per confidence bin, the twin's claimed confidence (tick)
 * vs what actually happened (bar). Well-calibrated = ticks sit on the bar tops.
 */
export function ReliabilityChart({ bins }: { bins: ReliabilityBin[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = bins.reduce((a, b) => a + b.count, 0);

  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap gap-4" aria-hidden>
        <Key className="bg-chart-2" label="What actually happened (hit rate)" />
        <Key className="bg-chart-1" label="What the twin claimed (confidence)" shape="tick" />
      </div>
      <div className="relative flex h-44 items-end gap-3 border-b border-border pl-8" role="img" aria-label={`Reliability over ${total} resolved predictions`}>
        {/* recessive gridlines + y labels */}
        {[0, 0.5, 1].map((y) => (
          <div key={y} className="pointer-events-none absolute left-0 right-0 flex items-center" style={{ bottom: `${y * 100}%` }}>
            <span className="w-7 -translate-y-1/2 text-right text-[10px] tabular-nums text-muted">{pct(y)}</span>
            <span className="ml-1 h-px flex-1 bg-border/60" />
          </div>
        ))}
        {bins.map((b, i) => (
          <div
            key={b.lo}
            tabIndex={0}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="group relative flex h-full flex-1 items-end justify-center outline-none"
            aria-label={`${pct(b.lo)}–${pct(b.hi)} confidence: ${b.count} predictions${b.count ? `, right ${pct(b.hitRate)}, claimed ${pct(b.meanConfidence)}` : ""}`}
          >
            {b.count > 0 ? (
              <>
                <div className="w-full max-w-10 rounded-t-[4px] bg-chart-2 transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(b.hitRate * 100, 1)}%` }} />
                <div className="absolute h-0.5 w-full max-w-12 bg-chart-1" style={{ bottom: `${b.meanConfidence * 100}%` }} />
              </>
            ) : (
              <div className="mb-1 text-[10px] text-muted">—</div>
            )}
            {hover === i && (
              <div role="tooltip" className="absolute bottom-full z-10 mb-2 w-40 rounded-md border border-border bg-surface p-2 text-xs shadow-md">
                <p className="font-medium">
                  Confidence {pct(b.lo)}–{pct(b.hi)}
                </p>
                {b.count ? (
                  <>
                    <p className="text-muted">{b.count} predictions</p>
                    <p>Right: {pct(b.hitRate)}</p>
                    <p>Claimed: {pct(b.meanConfidence)}</p>
                  </>
                ) : (
                  <p className="text-muted">No predictions yet</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-3 pl-8 text-[10px] text-muted" aria-hidden>
        {bins.map((b) => (
          <span key={b.lo} className="flex-1 text-center tabular-nums">
            {pct(b.lo)}–{pct(b.hi)}
          </span>
        ))}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted">Show as table</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-muted">
            <tr>
              <th className="font-normal">Confidence</th>
              <th className="font-normal">Predictions</th>
              <th className="font-normal">Claimed</th>
              <th className="font-normal">Actually right</th>
            </tr>
          </thead>
          <tbody>
            {bins.map((b) => (
              <tr key={b.lo}>
                <td>
                  {pct(b.lo)}–{pct(b.hi)}
                </td>
                <td>{b.count}</td>
                <td>{b.count ? pct(b.meanConfidence) : "—"}</td>
                <td>{b.count ? pct(b.hitRate) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

const TRAIT_NAMES: Record<TraitScore["trait"], [string, string]> = {
  risk_tolerance: ["Risk-averse", "Risk-seeking"],
  opportunity_over_stability: ["Stability", "Opportunity"],
  gut_over_analysis: ["Analytical", "Gut"],
  long_term_focus: ["Short-term", "Long-term"],
  social_influence: ["Independent of others", "Swayed by others"],
  procrastination: ["Starts early", "Procrastinates"],
  independence: ["Follows guidance", "Own path"],
  frugality: ["Spends freely", "Frugal"],
};

/** Stated (quiz) vs revealed (real choices) per trait — the Blind Spot Mirror's evidence. */
export function TraitComparison({ stated, revealed }: { stated: TraitScore[]; revealed: TraitScore[] }) {
  const rev = new Map(revealed.filter((r) => r.sampleCount > 0).map((r) => [r.trait, r]));
  const hasRevealed = rev.size > 0;

  return (
    <figure className="space-y-3">
      {hasRevealed && (
        <div className="flex flex-wrap gap-4" aria-hidden>
          <Key className="bg-chart-1" label="What you said (quiz)" />
          <Key className="bg-chart-2" label="What you did (real choices)" />
        </div>
      )}
      <ul className="space-y-3">
        {stated.map((s) => {
          const [lo, hi] = TRAIT_NAMES[s.trait];
          const r = rev.get(s.trait);
          return (
            <li key={s.trait} className="text-xs">
              <div className="flex justify-between text-muted">
                <span>{lo}</span>
                <span>{hi}</span>
              </div>
              <Bar value={s.sampleCount ? s.score : null} className="bg-chart-1" label={`${lo} vs ${hi}, stated`} />
              {hasRevealed && <Bar value={r ? r.score : null} className="bg-chart-2" label={`${lo} vs ${hi}, revealed (${r?.sampleCount ?? 0} choices)`} />}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

function Bar({ value, className, label }: { value: number | null; className: string; label: string }) {
  return (
    <div className="mt-1 flex items-center gap-2" title={value === null ? `${label}: unknown yet` : `${label}: ${pct(value)}`}>
      <div className="relative h-2 flex-1 rounded-full bg-surface-2">
        {/* centre line = neutral 0.5 */}
        <span aria-hidden className="absolute left-1/2 top-0 h-2 w-px bg-border" />
        {value !== null && <span className={cn("absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full ring-2 ring-surface", className)} style={{ left: pct(value) }} />}
      </div>
      <span className="w-9 text-right tabular-nums text-muted" aria-label={label}>
        {value === null ? "—" : pct(value)}
      </span>
    </div>
  );
}
