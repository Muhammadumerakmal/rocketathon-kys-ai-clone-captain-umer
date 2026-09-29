import type { Metadata } from "next";
import type { DueCheckin, Prediction } from "@/contracts";
import { PageHeader } from "@/components/shared/page-header";
import { Checkins } from "@/features/outcomes/checkins";
import { dueCheckins } from "@/server/repos/outcomes";
import { Card, CardDescription } from "@/components/ui/card";
import { PredictForm } from "@/features/predictions/predict-form";
import { PredictionCard } from "@/features/predictions/prediction-card";
import { requireViewer } from "@/lib/auth";
import { mockState } from "@/lib/mock/store";
import { recentPredictions } from "@/server/repos/predictions";

export const metadata: Metadata = { title: "Decisions" };

export default async function DecisionsPage() {
  const viewer = await requireViewer();
  const [recent, checkins]: [Prediction[], DueCheckin[]] =
    viewer.mode === "mock"
      ? [mockState().predictions, mockState().checkins]
      : await Promise.all([recentPredictions(viewer.supabase), dueCheckins(viewer.supabase)]);
  const open = recent.filter((p) => p.status === "open");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Decisions"
        description="Ask your twin to predict a choice. It runs 5 times and asks a stranger too — so you can see whether it really knows you."
      />

      <Checkins initial={checkins} />

      <PredictForm />

      <section className="space-y-3" aria-labelledby="open">
        <h2 id="open" className="font-display text-xl font-bold">
          Waiting for your real choice <span className="tabular-nums text-muted">({open.length})</span>
        </h2>
        {open.length === 0 ? (
          <Card>
            <CardDescription>No open predictions. Tell your twin what you actually chose to make it smarter.</CardDescription>
          </Card>
        ) : (
          open.slice(0, 10).map((p) => <PredictionCard key={p.id} prediction={p} />)
        )}
      </section>
    </div>
  );
}
