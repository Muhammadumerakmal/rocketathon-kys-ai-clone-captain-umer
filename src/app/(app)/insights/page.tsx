import { Eye, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { AccuracyChart } from "@/features/analytics/accuracy-chart";
import { ReliabilityChart } from "@/features/analytics/charts";
import { DecisionLedger } from "@/features/analytics/decision-ledger";
import { SayVsDo } from "@/features/analytics/say-vs-do";
import { leadSentence } from "@/lib/analytics/ledger";
import { requireViewer } from "@/lib/auth";
import { TRAIT_POLES } from "@/lib/training/labels";
import { pct } from "@/lib/utils";
import { loadDashboard } from "@/server/dashboard";

export const metadata: Metadata = { title: "Insights" };

/**
 * Insights (UI/UX plan §6.6): a sentence first, then the charts that back it up.
 * Server-rendered data; charts are small client islands. "Readiness" and "match rate",
 * never "% cloned".
 */
export default async function InsightsPage() {
  const viewer = await requireViewer();
  const d = await loadDashboard(viewer);
  const empty = d.ledger.length === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-[clamp(30px,8vw,44px)] font-bold leading-tight">Insights</h1>
        <p className="font-display text-xl font-semibold leading-snug">{leadSentence(d.ledger)}</p>
        {!empty && (
          <p className="text-sm text-muted">
            Personalization lift: <strong className="text-foreground">{d.liftPts > 0 ? "+" : ""}{d.liftPts} points</strong> over a stranger
            {d.brier !== null && <> · calibration (Brier) {d.brier.toFixed(2)}, lower is better</>}.
          </p>
        )}
      </header>

      {d.openRevisions > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-2 py-3">
          <p className="text-sm">
            {d.openRevisions} belief{d.openRevisions > 1 ? "s" : ""} changed — your twin needs you to confirm.
          </p>
          <Link href="/memories" className={buttonVariants({ size: "sm", variant: "secondary" })}>
            Review
          </Link>
        </Card>
      )}

      {empty ? (
        <Card className="space-y-3 text-center">
          <CardDescription>Confirm a few predictions and your twin&apos;s score will show up here.</CardDescription>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/duel" className={buttonVariants({ size: "sm" })}>
              Play Predict me
            </Link>
            <Link href="/twin" className={buttonVariants({ size: "sm", variant: "secondary" })}>
              Ask your twin
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <Card className="space-y-2">
            <CardTitle>Right over time</CardTitle>
            <AccuracyChart ledger={d.ledger} />
          </Card>
          <Card className="space-y-2">
            <CardTitle>Every decision</CardTitle>
            <DecisionLedger ledger={d.ledger} />
          </Card>
        </>
      )}

      <Card className="space-y-3">
        <CardTitle>What you say vs what you do</CardTitle>
        {d.readiness.known === 0 ? (
          <div className="space-y-2">
            <CardDescription>Train your twin so it knows how you decide.</CardDescription>
            <Link href="/train" className={buttonVariants({ size: "sm" })}>
              Start training
            </Link>
          </div>
        ) : (
          <>
            <SayVsDo stated={d.stated} revealed={d.revealed} />
            <CardDescription>
              {d.ceiling === null
                ? "Finish training to measure your own consistency."
                : `You gave the same answer ${pct(d.ceiling)} of the time when asked twice${d.relativeToCeiling !== null ? ` — your twin reaches ${pct(d.relativeToCeiling)} of that` : ""}.`}
            </CardDescription>
          </>
        )}
      </Card>

      {d.blindSpots.length > 0 && (
        <section className="space-y-3" aria-labelledby="blind">
          <h2 id="blind" className="flex items-center gap-2 font-display text-xl font-bold">
            <Eye className="size-5" aria-hidden /> Blind spots
          </h2>
          <div className="grid gap-3 min-[640px]:grid-cols-2">
            {d.blindSpots.map((b) => {
              const [lo, hi] = TRAIT_POLES[b.trait];
              return (
                <Card key={b.trait} className="space-y-1">
                  <Chip tone="warn">
                    {lo} ↔ {hi}
                  </Chip>
                  <p className="text-sm">
                    You say <strong>{pct(b.stated)}</strong>, but your real choices show <strong>{pct(b.revealed)}</strong> across {b.samples} decisions.
                  </p>
                  <CardDescription>Your twin now trusts your real choices more than your quiz answers here.</CardDescription>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {!empty && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <CardTitle>Is its confidence honest?</CardTitle>
            <span title="If your twin says 70%, it should be right about 70% of the time. Ticks on top of bars = honest.">
              <Info className="size-4 text-muted" aria-hidden />
            </span>
          </div>
          <ReliabilityChart bins={d.reliability} />
        </Card>
      )}

      <p className="text-center text-sm text-muted">
        <Link href="/decisions" className="underline underline-offset-4 hover:text-foreground">
          Decision journal
        </Link>{" "}
        ·{" "}
        <Link href="/council" className="underline underline-offset-4 hover:text-foreground">
          Council
        </Link>{" "}
        ·{" "}
        <Link href="/simulator" className="underline underline-offset-4 hover:text-foreground">
          Simulator
        </Link>
      </p>
    </div>
  );
}
