import { isMock } from "@/lib/env";
import { withApi } from "@/lib/http";
import { mockState } from "@/lib/mock/store";
import { requireUser } from "@/lib/supabase/server";
import { connectDemoCalendar } from "@/lib/connectors/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Connect the demo calendar (grants the twin a proposal-only, approval-gated tool). */
export const POST = withApi(async () => {
  if (isMock()) {
    mockState().calendarConnected = true;
    mockState().audit.unshift({ at: new Date().toISOString(), event: "connector.connected", detail: "demo-calendar" });
    return Response.json({ connected: true });
  }
  const { user } = await requireUser();
  await connectDemoCalendar(user.id);
  return Response.json({ connected: true });
});

export const DELETE = withApi(async () => {
  if (isMock()) {
    mockState().calendarConnected = false;
    mockState().audit.unshift({ at: new Date().toISOString(), event: "connector.disconnected", detail: "demo-calendar" });
    return Response.json({ connected: false });
  }
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("connector_accounts").delete().eq("provider", "demo-calendar");
  if (error) throw error;
  await supabase.from("audit_logs").insert({ user_id: user.id, event_type: "connector.disconnected", metadata: { provider: "demo-calendar" } });
  await supabase.from("consent_ledger").insert({ user_id: user.id, event: "revoke", scope: "connector:demo-calendar", detail: {} });
  return Response.json({ connected: false });
});
