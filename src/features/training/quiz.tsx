"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TrainingProgress } from "@/lib/training/progress";
import { cn, pct } from "@/lib/utils";
import { postJson } from "@/lib/fetcher";

/** Decision DNA quiz: one card at a time, keys 1–5 answer (plan §19). */
export function Quiz({ initial }: { initial: TrainingProgress }) {
  const [progress, setProgress] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = progress.next;

  const answer = useCallback(
    async (optionId: string) => {
      if (!next || saving) return;
      setSaving(true);
      setError(null);
      try {
        setProgress(
          await postJson<TrainingProgress>("/api/training", {
            questionId: next.question.id,
            optionId,
            attempt: next.attempt,
          }),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that answer.");
      } finally {
        setSaving(false);
      }
    },
    [next, saving],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      const option = next?.question.options[n - 1];
      if (option) answer(option.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, next]);

  const done = progress.answered + progress.retestsDone;
  const total = progress.total + progress.retestsTotal;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between text-sm text-muted">
          <span>
            Your twin now knows <strong className="text-foreground">{progress.readiness.known}</strong> of{" "}
            {progress.readiness.total} decision dimensions
          </span>
          <span>
            {done}/{total}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-surface-2" role="progressbar" aria-valuenow={done} aria-valuemax={total}>
          <div className="h-2 rounded-full bg-twin transition-all" style={{ width: pct(done / total) }} />
        </div>
      </div>

      {next ? (
        <Card className="space-y-4" aria-live="polite">
          {next.attempt === 2 && (
            <p className="text-xs font-medium text-twin">Consistency check — answer honestly, not from memory.</p>
          )}
          <h2 className="text-lg font-semibold">{next.question.question}</h2>
          <div className="grid gap-2">
            {next.question.options.map((o, i) => (
              <button
                key={o.id}
                type="button"
                disabled={saving}
                onClick={() => answer(o.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm transition-colors",
                  "hover:border-twin hover:bg-twin/5 disabled:opacity-60",
                )}
              >
                <kbd className="rounded border border-border px-1.5 text-xs text-muted">{i + 1}</kbd>
                {o.label}
              </button>
            ))}
          </div>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </Card>
      ) : (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Training complete</h2>
          <p className="text-sm text-muted">
            {progress.ceiling !== null
              ? `You answered ${pct(progress.ceiling)} of the repeat questions the same way — that's your own consistency, the ceiling your twin is measured against.`
              : "Your Decision DNA is set."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/memories" className={buttonVariants()}>
              Add memories
            </Link>
            <Link href="/duel" className={buttonVariants({ variant: "secondary" })}>
              Play Predict Me
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
