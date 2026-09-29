import "server-only";
import { run, RunState, type Agent } from "@openai/agents";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FocusBlockArgs, type ActionProposal, type ConnectorId, type ProposalStatus } from "@/contracts";
import { HttpError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADAPTERS } from "./adapter";
import { hashArgs, signApproval } from "./hmac";
import { checkProposal, PROPOSAL_TTL_MS, summarizeFocusBlock } from "./policy";

/**
 * Connector gateway (plan §14): proposed → approved (HMAC) → executed → audited.
 * paused_runs / action_proposals are server-only tables, so this module uses the admin
 * client and scopes every query to the verified user id explicitly.
 */

export async function isCalendarConnected(sb: SupabaseClient): Promise<boolean> {
  const { count } = await sb
    .from("connector_accounts")
    .select("id", { count: "exact", head: true })
    .eq("provider", "demo-calendar")
    .eq("status", "active");
  return (count ?? 0) > 0;
}

export async function connectDemoCalendar(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("connector_accounts")
    .upsert({ user_id: userId, provider: "demo-calendar", scopes: [...ADAPTERS["demo-calendar"]!.scopes], status: "active" }, { onConflict: "user_id,provider" });
  if (error) throw error;
  await audit(userId, "connector.connected", { provider: "demo-calendar" });
  await admin.from("consent_ledger").insert({ user_id: userId, event: "grant", scope: "connector:demo-calendar", detail: {} });
}

async function audit(userId: string, eventType: string, metadata: Record<string, unknown>) {
  const { error } = await createAdminClient().from("audit_logs").insert({ user_id: userId, event_type: eventType, metadata });
  if (error) console.error("[audit] insert failed", error.message);
}

/** Store the paused run + proposal; hand the browser only (id, token, summary). */
export async function createProposal(p: {
  userId: string;
  chatId: string | null;
  serializedState: string;
  rawArguments: string;
  connector: ConnectorId;
}): Promise<{ proposalId: string; token: string; summary: string }> {
  const args = FocusBlockArgs.parse(JSON.parse(p.rawArguments));
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + PROPOSAL_TTL_MS).toISOString();

  const { data: paused, error: e1 } = await admin
    .from("paused_runs")
    .insert({ user_id: p.userId, chat_id: p.chatId, serialized_state: p.serializedState, expires_at: expiresAt })
    .select("id")
    .single<{ id: string }>();
  if (e1) throw e1;

  const argsHash = hashArgs(args);
  const summary = summarizeFocusBlock(args);
  const { data: proposal, error: e2 } = await admin
    .from("action_proposals")
    .insert({
      user_id: p.userId,
      paused_run_id: paused.id,
      connector: p.connector,
      action: "create_focus_block",
      arguments: args,
      args_hash: argsHash,
      summary,
      expires_at: expiresAt,
    })
    .select("id")
    .single<{ id: string }>();
  if (e2) throw e2;

  await audit(p.userId, "action.proposed", { proposalId: proposal.id, connector: p.connector, summary });
  return { proposalId: proposal.id, token: signApproval({ proposalId: proposal.id, userId: p.userId, argsHash, expiresAt }), summary };
}

interface ProposalRow {
  id: string;
  user_id: string;
  paused_run_id: string | null;
  connector: ConnectorId;
  arguments: unknown;
  args_hash: string;
  status: ProposalStatus;
  expires_at: string;
}

export interface DecisionResult {
  status: ProposalStatus;
  result: Record<string, unknown> | null;
  reply: string;
}

/**
 * Verify → decide → resume the paused run. The tool's execute (adapter) only runs on approve.
 * `buildAgent(onExecute)` must build the same agent (same name + tool) as the paused run.
 */
export async function decideProposal(p: {
  userId: string;
  proposalId: string;
  token: string;
  decision: "approve" | "reject";
  buildAgent: (onExecute: (args: FocusBlockArgs) => Promise<Record<string, unknown>>) => Promise<Agent<unknown, "text">>;
}): Promise<DecisionResult> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("action_proposals")
    .select("id,user_id,paused_run_id,connector,arguments,args_hash,status,expires_at")
    .eq("id", p.proposalId)
    .eq("user_id", p.userId) // another user's proposal is simply "not found"
    .maybeSingle<ProposalRow>();
  if (error) throw error;
  if (!row) throw new HttpError("not_found", "Proposal not found.");

  const check = checkProposal(
    { id: row.id, userId: row.user_id, status: row.status, arguments: row.arguments, argsHash: row.args_hash, expiresAt: row.expires_at },
    p.token,
    p.userId,
  );
  if (!check.ok) {
    if (check.reason === "expired") await admin.from("action_proposals").update({ status: "expired" }).eq("id", row.id);
    await audit(p.userId, "action.blocked", { proposalId: row.id, reason: check.reason });
    throw new HttpError("forbidden", check.reason === "expired" ? "This proposal expired. Ask your twin again." : "This approval is not valid.");
  }

  const { data: paused } = await admin
    .from("paused_runs")
    .select("serialized_state")
    .eq("id", row.paused_run_id ?? "")
    .eq("user_id", p.userId)
    .maybeSingle<{ serialized_state: string }>();
  if (!paused) throw new HttpError("not_found", "The paused conversation is gone. Ask your twin again.");

  const adapter = ADAPTERS[row.connector];
  if (!adapter) throw new HttpError("bad_request", "Connector not available.");

  let executed: Record<string, unknown> | null = null;
  const agent = await p.buildAgent(async (args) => {
    // Re-validate: the args the model resumes with must be exactly what was approved.
    if (hashArgs(args) !== row.args_hash) throw new Error("Arguments changed after approval");
    executed = await adapter.execute("create_focus_block", args);
    return { status: "created", ...executed };
  });

  const state = await RunState.fromString(agent, paused.serialized_state);
  const pending = state.getInterruptions()[0];
  if (!pending) throw new HttpError("bad_request", "Nothing is waiting for approval.");

  await admin.from("action_proposals").update({ status: p.decision === "approve" ? "approved" : "rejected", decided_at: new Date().toISOString() }).eq("id", row.id);
  if (p.decision === "approve") state.approve(pending);
  else state.reject(pending, { message: "The user declined this calendar event. Acknowledge briefly; do not retry." });

  let reply = "";
  let status: ProposalStatus = p.decision === "approve" ? "approved" : "rejected";
  try {
    const resumed = await run(agent, state, { maxTurns: 3, signal: AbortSignal.timeout(45_000) });
    reply = String(resumed.finalOutput ?? "");
    if (p.decision === "approve") status = executed ? "executed" : "failed";
  } catch (err) {
    console.error("[gateway] resume failed", err);
    if (p.decision === "approve") status = executed ? "executed" : "failed";
  }

  await admin.from("action_proposals").update({ status, result: executed }).eq("id", row.id);
  await admin.from("paused_runs").delete().eq("id", row.paused_run_id!);
  await audit(p.userId, `action.${status}`, { proposalId: row.id, connector: row.connector, result: executed });

  return { status, result: executed, reply };
}

export async function listProposals(sb: SupabaseClient): Promise<ActionProposal[]> {
  const { data, error } = await sb
    .from("action_proposals")
    .select("id,connector,action,arguments,summary,status,expires_at")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<{ id: string; connector: ConnectorId; action: string; arguments: Record<string, unknown>; summary: string; status: ProposalStatus; expires_at: string }[]>();
  if (error) throw error;
  return data.map((r) => ({ id: r.id, connector: r.connector, action: r.action, arguments: r.arguments, summary: r.summary, status: r.status, expiresAt: new Date(r.expires_at).toISOString() }));
}

export async function listAudit(sb: SupabaseClient) {
  const { data, error } = await sb
    .from("audit_logs")
    .select("id,event_type,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<{ id: number; event_type: string; metadata: Record<string, unknown>; created_at: string }[]>();
  if (error) throw error;
  return data;
}
