import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { CouncilView } from "@/features/council/council-view";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Council" };

export default async function CouncilPage() {
  await requireViewer();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Council"
        description="Your goals each get a voice, plus a Devil’s Advocate. You get the disagreement map — and the decision stays yours."
      />
      <CouncilView />
    </div>
  );
}
