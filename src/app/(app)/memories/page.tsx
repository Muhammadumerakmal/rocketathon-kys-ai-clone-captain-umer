import type { Metadata } from "next";
import { MemoriesView } from "@/features/memories/memories-view";
import { requireViewer } from "@/lib/auth";
import { mockState } from "@/lib/mock/store";
import { listMemories } from "@/server/repos/memories";
import { openRevisions } from "@/server/repos/revisions";

export const metadata: Metadata = { title: "Memories" };

export default async function MemoriesPage() {
  const viewer = await requireViewer();
  const [memories, revisions] =
    viewer.mode === "mock"
      ? [mockState().memories, mockState().revisions]
      : await Promise.all([listMemories(viewer.supabase), openRevisions(viewer.supabase)]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Memories</h1>
        <p className="mt-1 text-sm text-muted">
          Nothing is overwritten. When you change, old beliefs are closed — not deleted — so you can ask how past-you would decide.
        </p>
      </header>
      <MemoriesView initialMemories={memories} initialRevisions={revisions} />
    </div>
  );
}
