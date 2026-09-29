import "server-only";
import type { FocusBlockArgs, TwinStreamEvent } from "@/contracts";
import { demoCalendar } from "@/lib/connectors/adapter";
import { hashArgs, signApproval } from "@/lib/connectors/hmac";
import { checkProposal, PROPOSAL_TTL_MS, summarizeFocusBlock } from "@/lib/connectors/policy";
import { mid } from "./fixtures";
import { mockState } from "./store";

/**
 * Demo-mode approvals: same HMAC + policy code as live, in-memory storage.
 * The demo may run without APPROVAL_HMAC_SECRET, so it falls back to a fixed demo key.
 */
const DEMO_SECRET = "twinos-demo-mode-approval-key-not-for-production";
const secret = () => (process.env.APPROVAL_HMAC_SECRET && process.env.APPROVAL_HMAC_SECRET.length >= 32 ? process.env.APPROVAL_HMAC_SECRET : DEMO_SECRET);

/** Same least-privilege rule as live: no connected calendar, no tool. */
export const NOT_CONNECTED: TwinStreamEvent[] = [
  { type: "meta", chatId: mid(0x400) },
  { type: "text", delta: "I can’t touch your calendar — none is connected. You can connect one in Settings → Connections; I’ll still need your approval for every event." },
  { type: "done" },
];

export const wantsScheduling = (msg: string) => /\b(block|schedule|calendar|focus time|book)\b/i.test(msg);

const proposals = () => mockState();

/** Tomorrow 09:00 UTC, 45 minutes — the demo script's focus block. */
function demoArgs(msg: string): FocusBlockArgs {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(9, 0, 0, 0);
  const minutes = Number(/(\d{2,3})\s*(min|minute)/i.exec(msg)?.[1] ?? 45);
  return { title: "Focus: hackathon prep", start: d.toISOString(), minutes: Math.min(180, Math.max(15, minutes)) };
}

export function mockProposalStream(msg: string): TwinStreamEvent[] {
  const s = proposals();
  const args = demoArgs(msg);
  const id = crypto.randomUUID();
  const argsHash = hashArgs(args);
  const expiresAt = new Date(Date.now() + PROPOSAL_TTL_MS).toISOString();
  const summary = summarizeFocusBlock(args);
  s.proposals.unshift({ id, userId: mid(0xa), connector: "demo-calendar", action: "create_focus_block", arguments: args, args, argsHash, summary, status: "proposed", expiresAt, result: null });
  s.audit.unshift({ at: new Date().toISOString(), event: "action.proposed", detail: summary });
  return [
    { type: "meta", chatId: mid(0x400) },
    { type: "text", delta: "Based on what you've told me, a protected morning block fits how you work best. " },
    { type: "text", delta: "I've prepared it — nothing is created until you approve the exact details below." },
    { type: "approval_required", proposalId: id, token: signApproval({ proposalId: id, userId: mid(0xa), argsHash, expiresAt }, secret()), summary },
    { type: "done" },
  ];
}

export async function mockDecide(p: { proposalId: string; token: string; decision: "approve" | "reject" }) {
  const s = proposals();
  const row = s.proposals.find((x) => x.id === p.proposalId);
  if (!row) return null;
  const check = checkProposal({ id: row.id, userId: row.userId, status: row.status, arguments: row.args, argsHash: row.argsHash, expiresAt: row.expiresAt }, p.token, row.userId, { secret: secret() });
  if (!check.ok) {
    s.audit.unshift({ at: new Date().toISOString(), event: "action.blocked", detail: check.reason });
    return { error: check.reason };
  }
  if (p.decision === "reject") {
    row.status = "rejected";
    s.audit.unshift({ at: new Date().toISOString(), event: "action.rejected", detail: row.summary });
    return { status: row.status, result: null, reply: "Okay — I won't add it. Want a different time?" };
  }
  row.result = await demoCalendar.execute("create_focus_block", row.args);
  row.status = "executed";
  s.audit.unshift({ at: new Date().toISOString(), event: "action.executed", detail: row.summary });
  return { status: row.status, result: row.result, reply: `Done — "${row.args.title}" is in your demo calendar.` };
}

export const mockProposals = () => proposals().proposals;
export const mockAudit = () => proposals().audit;
