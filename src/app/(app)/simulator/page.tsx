import type { Metadata } from "next";
import { SimulatorView } from "@/features/simulator/simulator-view";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Simulator" };

export default async function SimulatorPage() {
  await requireViewer();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Simulator</h1>
        <p className="mt-1 text-sm text-muted">Two paths, side by side: upsides, trade-offs, how each could fail, and how reversible it is.</p>
      </header>
      <SimulatorView />
    </div>
  );
}
