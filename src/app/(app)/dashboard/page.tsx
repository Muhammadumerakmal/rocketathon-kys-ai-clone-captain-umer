import { Eye, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ReliabilityChart, TraitComparison } from "@/features/analytics/charts";
import { requireViewer } from "@/lib/auth";
import { pct } from "@/lib/utils";
import { loadDashboard } from "@/server/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

/** The honesty dashboard (plan §19): does the twin actually know you, and is it honest about it? */
export default async function DashboardPage() {
  const viewer = await requireViewer();
  const d = await loadDashboard(viewer);
  const empty = d.resolved === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted">Readiness and match rate — never &quot;% cloned&quot;.</p>
        </div>
        {viewer.mode === "mock" && <Badge tone="warning">Demo mode</Badge>}
      </header>

      {d.openRevisions > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-2 border-warning/60 py-3">
          <p className="text-sm">
            {d.openRevisions} belief{d.openRevisions > 1 ? "s" : ""} changed — your twin needs you to confirm.
          </p>
          <Link href="/memories" className={buttonVariants({ size: "sm", variant: "secondary" })}>
            Review
          </Link>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Headline numbers">
        <Card>
          <CardDescription>Personalization lift</CardDescription>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{empty ? "—" : `${d.liftPts > 0 ? "+" : ""}${d.liftPts} pts`}</p>
          <CardDescription>
            {empty ? "Resolve a prediction or play Predict Me" : `twin ${pct(d.twinAccuracy ?? 0)} vs stranger ${pct(d.strangerAccuracy ?? 0)}, ${d.resolved} decisions`}
          </CardDescription>
        </Card>
        <Card>
          <CardDescription>Readiness</CardDescription>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {d.readiness.known}/{d.readiness.total}
          </p>
          <CardDescription>decision dimensions known · {d.memoryCount} memories</CardDescription>
        </Card>
        <Card>
          <CardDescription>Your own consistency</CardDescription>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{d.ceiling === null ? "—" : pct(d.ceiling)}</p>
          <CardDescription>
            {d.ceiling === null
              ? "Finish training to measure it"
              : d.relativeToCeiling !== null
                ? `twin reaches ${pct(d.relativeToCeiling)} of it`
                : "same answer when asked twice"}
          </CardDescription>
        </Card>
        <Card>
          <CardDescription>Calibration (Brier)</CardDescription>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{d.brier === null ? "—" : d.brier.toFixed(2)}</p>
          <CardDescription>lower is better · 0.25 = coin flip</CardDescription>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <CardTitle>Is its confidence honest?</CardTitle>
            <span title="If the twin says 70%, it should be right about 70% of the time. Ticks on top of bars = honest.">
              <Info className="size-4 text-muted" aria-hidden />
            </span>
          </div>
          {empty ? <CardDescription>No resolved predictions yet.</CardDescription> : <ReliabilityChart bins={d.reliability} />}
        </Card>

        <Card className="space-y-3">
          <CardTitle>Decision DNA</CardTitle>
          {d.readiness.known === 0 ? (
            <div className="space-y-2">
              <CardDescription>Take the quiz so your twin learns how you decide.</CardDescription>
              <Link href="/train" className={buttonVariants({ size: "sm" })}>
                Start training
              </Link>
            </div>
          ) : (
            <TraitComparison stated={d.stated} revealed={d.revealed} />
          )}
        </Card>
      </div>

      <section className="space-y-3" aria-labelledby="blind">
        <h2 id="blind" className="flex items-center gap-2 text-lg font-semibold">
          <Eye className="size-5" aria-hidden /> Blind Spot Mirror
        </h2>
        {d.blindSpots.length === 0 ? (
          <Card>
            <CardDescription>
              No blind spots yet. They appear when what you say and what you do differ by 30+ points across at least 3 real choices.
            </CardDescription>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {d.blindSpots.map((b) => (
              <Card key={b.trait} className="space-y-1">
                <CardTitle className="capitalize">{b.trait.replaceAll("_", " ")}</CardTitle>
                <p className="text-sm">
                  You say <strong>{pct(b.stated)}</strong>, but your real choices show <strong>{pct(b.revealed)}</strong> across {b.samples} decisions.
                </p>
                <CardDescription>Your twin now weights your real choices more than your quiz answers here.</CardDescription>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
