import type { FocusBlockArgs, ProposalStatus } from "@/contracts";
import { hashArgs, verifyApproval } from "./hmac";

/**
 * Pure approval policy (plan §10, §14): a proposal may execute only if it is still pending,
 * unexpired, signed for THIS user, and its stored arguments are exactly what was signed.
 */

export const PROPOSAL_TTL_MS = 15 * 60_000;

export interface StoredProposal {
  id: string;
  userId: string;
  status: ProposalStatus;
  arguments: unknown;
  argsHash: string;
  expiresAt: string;
}

export type ProposalCheck =
  | { ok: true }
  | { ok: false; reason: "not_pending" | "expired" | "bad_signature" | "tampered_args" };

export function checkProposal(p: StoredProposal, token: string, userId: string, opts: { secret?: string; now?: Date } = {}): ProposalCheck {
  if (p.status !== "proposed") return { ok: false, reason: "not_pending" };
  // Recompute from what's stored: catches edits to the arguments after signing.
  if (hashArgs(p.arguments) !== p.argsHash) return { ok: false, reason: "tampered_args" };
  const v = verifyApproval({ proposalId: p.id, userId, argsHash: p.argsHash, expiresAt: p.expiresAt }, token, opts);
  return v.ok ? { ok: true } : { ok: false, reason: v.reason };
}

/** Exact, human-readable text for the approval card. Times are shown in the viewer's zone client-side. */
export function summarizeFocusBlock(a: FocusBlockArgs): string {
  return `Create a ${a.minutes}-minute calendar event "${a.title}" starting ${a.start}`;
}

export function focusBlockEnd(a: FocusBlockArgs): string {
  return new Date(Date.parse(a.start) + a.minutes * 60_000).toISOString();
}
