"use client";

import { useState } from "react";
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
        <Key className="bg-ink" label="What actually happened (hit rate)" />
        <Key className="bg-chart-twin" label="What the twin claimed (confidence)" shape="tick" />
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
                <div className="w-full max-w-10 rounded-t-[4px] bg-ink transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(b.hitRate * 100, 1)}%` }} />
                <div className="absolute h-0.5 w-full max-w-12 bg-chart-twin" style={{ bottom: `${b.meanConfidence * 100}%` }} />
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
