"use client";

import { AlertTriangle, CheckCircle2, UserRound, Users } from "lucide-react";
import { useState } from "react";
import type { Prediction } from "@/contracts";
import { EvidenceList } from "@/components/shared/evidence-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { postJson } from "@/lib/fetcher";
import { cn, pct } from "@/lib/utils";

/**
 * The honest prediction card: full vote distribution (never just the winner),
 * twin vs stranger, confidence explained in words, evidence, and the feedback loop.
 */
export function PredictionCard({ prediction, onResolved }: { prediction: Prediction; onResolved?: () => void }) {
  const p = prediction;
  const [resolved, setResolved] = useState<{ actual: string; twinCorrect: boolean; baselineCorrect: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      onResolved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {p.asOf && <Badge tone="twin">as of {p.asOf.slice(0, 10)}</Badge>}
        {p.baseline.agreesWithTwin ? (
          <Badge title="A generic model with no personal data chose the same option">Generic answer — your data didn&apos;t change this</Badge>
        ) : (
          <Badge tone="success">
            <CheckCircle2 className="size-3" aria-hidden /> Personalized — a stranger would pick differently
          </Badge>
        )}
        {p.underInformed && (
          <Badge tone="warning">
            <AlertTriangle className="size-3" aria-hidden /> Confident but under-informed
          </Badge>
        )}
      </div>

      <p className="text-sm">{p.scenario}</p>

      <ul className="space-y-2" aria-label="How the twin's runs voted">
        {p.options.map((o) => {
          const share = p.distribution[o] ?? 0;
          return (
            <li key={o}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className={cn(o === p.topChoice && "font-semibold")}>{o}</span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {o === p.baseline.choice && (
                    <span className="flex items-center gap-1 text-stranger" title="What a generic model with no personal data chose">
                      <Users className="size-3" aria-hidden /> stranger
                    </span>
                  )}
                  {o === p.topChoice && (
                    <span className="flex items-center gap-1 text-twin">
                      <UserRound className="size-3" aria-hidden /> twin
                    </span>
                  )}
                  <span className="tabular-nums">{pct(share)}</span>
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-surface-2">
                <div className={cn("h-2 rounded-full", o === p.topChoice ? "bg-twin" : "bg-stranger")} style={{ width: pct(share) }} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rounded-lg bg-surface-2 p-3 text-sm">
        <p>
          <span className="font-medium capitalize">{p.confidence.band}</span> ({pct(p.confidence.value)})
          {p.confidence.reasons.length > 0 && <>: {p.confidence.reasons.join("; ")}.</>}
        </p>
        <p className="mt-1 text-xs text-muted">Twin confidence is a heuristic calibrated on your past decisions — not the probability you&apos;ll choose it.</p>
      </div>

      {p.rationale.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {p.rationale.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <CardTitle className="mb-2 text-xs uppercase tracking-wide text-muted">Evidence</CardTitle>
          <EvidenceList evidence={p.evidence} />
        </div>
        {p.missingInfo.length > 0 && (
          <div>
            <CardTitle className="mb-2 text-xs uppercase tracking-wide text-muted">Would change my mind</CardTitle>
            <ul className="space-y-1 text-xs">
              {p.missingInfo.map((m) => (
                <li key={m}>• {m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4">
        {resolved ? (
          <p className="text-sm" role="status">
            {resolved.twinCorrect ? "✓ Your twin got it right." : "✗ Your twin missed — it just learned from this."}{" "}
            {resolved.baselineCorrect ? "The stranger got it right too." : "The stranger missed."}{" "}
            <span className="text-muted">We&apos;ll check in next week on how it went.</span>
          </p>
        ) : p.status === "resolved" ? (
          <CardDescription>Resolved.</CardDescription>
        ) : (
          <div className="space-y-2">
            <CardDescription>When you&apos;ve decided — what did you actually choose?</CardDescription>
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
      </div>
    </Card>
  );
}
