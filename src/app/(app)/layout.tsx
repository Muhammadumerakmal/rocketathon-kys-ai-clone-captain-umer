import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireViewer } from "@/lib/auth";
import { loadShell } from "@/server/shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  const { readiness, pendingRevisions } = await loadShell(viewer);

  return (
    <AppShell readiness={readiness} pendingRevisions={pendingRevisions} demo={viewer.mode === "mock"} displayName={viewer.displayName}>
      {children}
    </AppShell>
  );
}
