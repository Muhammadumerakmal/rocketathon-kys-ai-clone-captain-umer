import type { Metadata } from "next";
import { CouncilView } from "@/features/council/council-view";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Council" };

export default async function CouncilPage() {
  await requireViewer();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Council</h1>
        <p className="mt-1 text-sm text-muted">
          Your goals each get a voice, plus a Devil&apos;s Advocate. You get the disagreement map — and the decision stays yours.
        </p>
      </header>
      <CouncilView />
    </div>
  );
}
