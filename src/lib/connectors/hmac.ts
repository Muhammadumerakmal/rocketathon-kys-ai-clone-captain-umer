import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Approval tokens (plan §10): HMAC-SHA256 over (proposal_id, user_id, args_hash, expires_at).
 * Execution recomputes and rejects on mismatch, tampered args or expiry.
 */

/** Deterministic JSON: object keys sorted recursively, so hashing is order-independent. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function hashArgs(args: unknown): string {
  return createHash("sha256").update(canonicalJson(args)).digest("hex");
}

export interface ApprovalClaims {
  proposalId: string;
  userId: string;
  argsHash: string;
  /** ISO timestamp */
  expiresAt: string;
}

function payload(c: ApprovalClaims): string {
  // Unit separator can't appear in uuids / hex / ISO dates, so fields can't be spliced.
  return [c.proposalId, c.userId, c.argsHash, new Date(c.expiresAt).toISOString()].join("\u001f");
}

function requireSecret(secret: string | undefined): string {
  if (!secret || secret.length < 32) {
    throw new Error("APPROVAL_HMAC_SECRET must be set and at least 32 characters");
  }
  return secret;
}

export function signApproval(claims: ApprovalClaims, secret = process.env.APPROVAL_HMAC_SECRET): string {
  return createHmac("sha256", requireSecret(secret)).update(payload(claims)).digest("hex");
}

export type VerifyResult = { ok: true } | { ok: false; reason: "expired" | "bad_signature" };

export function verifyApproval(
  claims: ApprovalClaims,
  token: string,
  { secret = process.env.APPROVAL_HMAC_SECRET, now = new Date() }: { secret?: string; now?: Date } = {},
): VerifyResult {
  const expected = Buffer.from(signApproval(claims, secret), "hex");
  const given = Buffer.from(/^[a-f0-9]{64}$/.test(token) ? token : "", "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad_signature" };
  }
  if (now.getTime() >= new Date(claims.expiresAt).getTime()) return { ok: false, reason: "expired" };
  return { ok: true };
}
