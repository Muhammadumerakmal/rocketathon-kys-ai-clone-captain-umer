import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SimulatorView } from "@/features/simulator/simulator-view";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Simulator" };

export default async function SimulatorPage() {
  await requireViewer();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Simulator" description="Two paths, side by side: upsides, trade-offs, how each could fail, and how reversible it is." />
      <SimulatorView />
    </div>
  );
}
