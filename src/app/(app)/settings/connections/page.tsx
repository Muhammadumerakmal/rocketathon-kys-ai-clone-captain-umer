import { CalendarDays, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConnectionToggle } from "@/features/connectors/connection-toggle";
import { localizeSummary } from "@/lib/format";
import { requireViewer } from "@/lib/auth";
import { demoCalendar } from "@/lib/connectors/adapter";
import { isCalendarConnected, listAudit, listProposals } from "@/lib/connectors/gateway";
import { mockState } from "@/lib/mock/store";

export const metadata: Metadata = { title: "Connections" };

const STATUS_TONE = { proposed: "warning", approved: "twin", executed: "success", rejected: "neutral", failed: "danger", expired: "neutral" } as const;

/** Connections, pending approvals and the append-only audit log (plan §19). */
export default async function ConnectionsPage() {
  const viewer = await requireViewer();
  const [connected, proposals, audit] =
    viewer.mode === "mock"
      ? [
          mockState().calendarConnected,
          mockState().proposals,
          mockState().audit.map((a, i) => ({ id: i, event_type: a.event, metadata: { detail: a.detail }, created_at: a.at })),
        ]
      : await Promise.all([isCalendarConnected(viewer.supabase), listProposals(viewer.supabase), listAudit(viewer.supabase)]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="mt-1 text-sm text-muted">Your twin can only propose actions. Every one needs your approval, and every step is logged.</p>
      </header>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4" aria-hidden /> {demoCalendar.label}
          </CardTitle>
          <ConnectionToggle connected={connected} />
        </div>
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">
          {demoCalendar.scopes.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <CardDescription>
          Built-in calendar for trying approvals safely. Google Calendar plugs into the same approval gate.
        </CardDescription>
        {connected && <CardDescription>Try it: ask your twin &quot;Block 45 minutes tomorrow morning to prep&quot;.</CardDescription>}
      </Card>

      <Card className="space-y-3">
        <CardTitle>Proposed actions</CardTitle>
        {proposals.length === 0 ? (
          <CardDescription>Nothing proposed yet.</CardDescription>
        ) : (
          <ul className="space-y-2">
            {proposals.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 text-sm">
                <span>{localizeSummary(p.summary)}</span>
                <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="size-4" aria-hidden /> Audit log
        </CardTitle>
        <CardDescription>Append-only: it can&apos;t be edited or deleted, not even by you.</CardDescription>
        {audit.length === 0 ? (
          <CardDescription>No events yet.</CardDescription>
        ) : (
          <ol className="space-y-1.5 text-xs">
            {audit.map((a) => (
              <li key={a.id} className="flex gap-3">
                <time className="shrink-0 tabular-nums text-muted" dateTime={a.created_at}>
                  {new Date(a.created_at).toLocaleString()}
                </time>
                <code className="shrink-0">{a.event_type}</code>
                <span className="truncate text-muted">{String((a.metadata as { summary?: string; detail?: string }).summary ?? (a.metadata as { detail?: string }).detail ?? "")}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
