"use client";

import { AlertTriangle, Check, Sparkles, Users } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { EvidenceRef, Prediction } from "@/contracts";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { StreamedText } from "@/components/ui/streamed-text";
import { postJson } from "@/lib/fetcher";
import { springs } from "@/lib/motion/tokens";
import { cn, pct } from "@/lib/utils";
import { TimeTravelToggle } from "./time-travel-toggle";

/**
 * The honest prediction card (Ultra plan §11.3, UI/UX plan §6.4). Progressive reveal:
 * headline → bars → confidence → evidence → stranger → feedback. Re-timing the card
 * (Now ↔ past) morphs the SAME card: bars animate to new shares, headline re-streams.
 */
export function PredictionCard({
  prediction,
  onRetime,
  retiming = false,
}: {
  prediction: Prediction;
  /** Time-travel (F5). When provided, shows the Now / past toggle. */
  onRetime?: (asOf: string | null) => void;
  retiming?: boolean;
}) {
  const p = prediction;
  const reduced = useReducedMotion();
  const [resolved, setResolved] = useState<{ actual: string; twinCorrect: boolean; baselineCorrect: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState(p.evidence);
  const needsAblation = p.status === "open" && p.evidence.length > 0 && p.evidence.some((e) => e.pivotal === undefined);
  const [checking, setChecking] = useState(needsAblation);

  // keep evidence in sync when the card is re-timed
  const [shownFor, setShownFor] = useState(p.id);
  if (shownFor !== p.id) {
    setShownFor(p.id);
    setEvidence(p.evidence);
  }

  // Counterfactual check runs AFTER the card renders (F3): pivotal badges pop in later.
  useEffect(() => {
    if (!needsAblation) return;
    let cancelled = false;
    postJson<{ evidence: EvidenceRef[] }>(`/api/predict/${p.id}/ablate`, {})
      .then((r) => !cancelled && setEvidence(r.evidence))
      .catch(() => undefined) // optional enrichment: the card is complete without it
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [needsAblation, p.id]);

  async function resolve(actual: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await postJson<{ twinCorrect: boolean; baselineCorrect: boolean }>("/api/feedback", {
        predictionId: p.id,
        verdict: actual === p.topChoice ? "correct" : "wrong",
        actualChoice: actual,
      });
      setResolved({ actual, ...res });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  /** progressive reveal: group i fades in 0.45 s after the previous one (first render only) */
  const stage = (i: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.28, delay: i * 0.45 } };

  return (
    <article className={cn("space-y-4 rounded-[var(--r-lg)] border border-line bg-surface p-5 shadow-[var(--shadow)]", retiming && "opacity-70")} aria-busy={retiming}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{p.scenario}</p>
        {onRetime && <TimeTravelToggle asOf={p.asOf} onChange={onRetime} disabled={retiming} />}
      </div>

      {/* 1 · headline (re-streams when re-timed) */}
      <h3 className="font-display text-2xl font-bold leading-tight" aria-live="polite">
        <StreamedText key={`${p.id}-h`} text={`${p.asOf ? "Back then, you'd" : "You'd"} probably pick “${p.topChoice}”.`} />
      </h3>

      {/* 2 · bars grow to vote share */}
      <m.ul className="space-y-2.5" aria-label="How your twin's five runs voted" {...stage(1)}>
        {p.options.map((o) => {
          const share = p.distribution[o] ?? 0;
          const top = o === p.topChoice;
          return (
            <li key={o}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className={cn(top && "font-semibold")}>{o}</span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {o === p.baseline.choice && (
                    <span className="flex items-center gap-1 text-stranger">
                      <Users className="size-3" aria-hidden /> stranger
                    </span>
                  )}
                  <span className="tabular-nums">{pct(share)}</span>
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-2">
                {/* scaleX, not width: transform-only animation (plan §9) */}
                <m.div
                  className={cn("h-full origin-left rounded-full", top ? "bg-twin" : "bg-faint/40")}
                  initial={reduced ? false : { scaleX: 0 }}
                  animate={{ scaleX: share }}
                  transition={reduced ? { duration: 0 } : { ...springs.gentle, delay: 0.45 }}
                />
              </div>
            </li>
          );
        })}
      </m.ul>

      {/* 3 · confidence, explained in words */}
      <m.div className="rounded-[var(--r-md)] bg-surface-2 p-3 text-sm" {...stage(2)}>
        <p>
          <span className="font-semibold capitalize">{p.confidence.band}</span> confidence ({pct(p.confidence.value)})
          {p.confidence.reasons.length > 0 && <>: {p.confidence.reasons.join("; ")}.</>}
        </p>
        {p.underInformed && (
          <p className="mt-1 flex items-center gap-1.5 text-warning">
            <AlertTriangle className="size-4" aria-hidden /> Confident but under-informed — tell your twin more about this.
          </p>
        )}
        <p className="mt-1 text-xs text-muted">A heuristic calibrated on your past decisions, not the probability you&apos;ll choose it.</p>
      </m.div>

      {/* 4 · evidence chips (pivotal badges pop in after the counterfactual check) */}
      <m.div {...stage(3)}>
        <p className="mb-1.5 text-xs font-semibold text-muted">
          Why {checking && <span className="font-normal">· checking which memories really mattered…</span>}
        </p>
        {evidence.length === 0 ? (
          <p className="text-sm text-muted">No personal memories were relevant — treat this as a generic answer.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {evidence.map((e) => (
              <li key={e.id}>
                <span className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[13px]" title={`relevance ${pct(e.relevance)}`}>
                  {e.label}
                  {e.pivotal && (
                    <Chip tone="twin" popIn className="ml-1 px-1.5 text-[11px]" title="Removing this memory changed the answer">
                      <Sparkles className="size-3" aria-hidden /> pivotal
                    </Chip>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {p.missingInfo.length > 0 && <p className="mt-2 text-xs text-muted">Would change my mind: {p.missingInfo.join(" · ")}</p>}
      </m.div>

      {/* 5 · the stranger line */}
      <m.p className="text-sm" {...stage(4)}>
        {p.baseline.agreesWithTwin ? (
          <Chip tone="stranger">A stranger would pick the same — your data didn&apos;t change this one.</Chip>
        ) : (
          <Chip tone="ok">
            <Check className="size-3.5" aria-hidden /> Personalized: a stranger would pick “{p.baseline.choice}”.
          </Chip>
        )}
      </m.p>

      {/* 6 · feedback */}
      <m.div className="border-t border-line pt-4" {...stage(5)}>
        {resolved ? (
          <p className="text-sm" role="status">
            {resolved.twinCorrect ? "Your twin got it right." : "Your twin missed — it just learned from this."}{" "}
            {resolved.baselineCorrect ? "The stranger got it right too." : "The stranger missed."}{" "}
            <span className="text-muted">We&apos;ll check in next week on how it went.</span>
          </p>
        ) : p.status === "resolved" ? (
          <p className="text-sm text-muted">Resolved.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">Was this right? What did you actually choose?</p>
            <div className="flex flex-wrap gap-2">
              {p.options.map((o) => (
                <Button key={o} size="sm" variant="secondary" disabled={saving} onClick={() => resolve(o)}>
                  {o}
                </Button>
              ))}
            </div>
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </m.div>
    </article>
  );
}
