import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { duelScoreboard, prediction } from "@/lib/mock/fixtures";
import { pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

/** Phase 0 placeholder: renders mock fixtures. Phase 8 replaces these with real rows. */
export default function DashboardPage() {
  const { rounds, twinHits, baselineHits, liftPts } = duelScoreboard;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Badge tone="warning">Mock data · phase 0</Badge>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardDescription>Personalization lift</CardDescription>
          <p className="mt-1 text-3xl font-semibold text-twin">+{liftPts} pts</p>
          <CardDescription>twin vs stranger, {rounds} rounds</CardDescription>
        </Card>
        <Card>
          <CardDescription>Twin match rate</CardDescription>
          <p className="mt-1 text-3xl font-semibold">{pct(twinHits / rounds)}</p>
        </Card>
        <Card>
          <CardDescription>Stranger match rate</CardDescription>
          <p className="mt-1 text-3xl font-semibold text-stranger">{pct(baselineHits / rounds)}</p>
        </Card>
      </section>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Latest prediction</CardTitle>
          {!prediction.baseline.agreesWithTwin && <Badge tone="twin">Personalized ✓</Badge>}
        </div>
        <p className="text-sm">{prediction.scenario}</p>
        <ul className="space-y-2">
          {prediction.options.map((o) => {
            const share = prediction.distribution[o] ?? 0;
            return (
              <li key={o}>
                <div className="flex justify-between text-sm">
                  <span>{o}</span>
                  <span className="text-muted">{pct(share)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-surface-2">
                  <div className="h-2 rounded-full bg-twin" style={{ width: pct(share) }} />
                </div>
              </li>
            );
          })}
        </ul>
        <CardDescription>
          Twin confidence {pct(prediction.confidence.value)} ({prediction.confidence.band}):{" "}
          {prediction.confidence.reasons.join("; ")}.
        </CardDescription>
      </Card>
    </div>
  );
}
