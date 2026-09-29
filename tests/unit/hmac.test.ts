import { describe, expect, it } from "vitest";
import { canonicalJson, hashArgs, signApproval, verifyApproval, type ApprovalClaims } from "@/lib/connectors/hmac";

const SECRET = "x".repeat(32);
const claims: ApprovalClaims = {
  proposalId: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-00000000000a",
  argsHash: hashArgs({ title: "Focus", minutes: 45 }),
  expiresAt: "2026-09-30T10:00:00Z",
};
const before = new Date("2026-09-30T09:59:00Z");

describe("canonicalJson / hashArgs", () => {
  it("is independent of key order, including nested objects", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
    expect(hashArgs({ b: 1, a: 2 })).toBe(hashArgs({ a: 2, b: 1 }));
  });

  it("changes when any argument changes", () => {
    expect(hashArgs({ minutes: 45 })).not.toBe(hashArgs({ minutes: 46 }));
  });
});

describe("approval tokens", () => {
  const token = signApproval(claims, SECRET);

  it("produces a 64-char hex token", () => {
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies a valid, unexpired token", () => {
    expect(verifyApproval(claims, token, { secret: SECRET, now: before })).toEqual({ ok: true });
  });

  it("rejects tampered args", () => {
    const tampered = { ...claims, argsHash: hashArgs({ title: "Focus", minutes: 180 }) };
    expect(verifyApproval(tampered, token, { secret: SECRET, now: before })).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects another user replaying the token", () => {
    const other = { ...claims, userId: "00000000-0000-4000-8000-00000000000b" };
    expect(verifyApproval(other, token, { secret: SECRET, now: before }).ok).toBe(false);
  });

  it("rejects expired tokens", () => {
    expect(verifyApproval(claims, token, { secret: SECRET, now: new Date("2026-09-30T10:00:00Z") })).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects malformed tokens without throwing", () => {
    expect(verifyApproval(claims, "nope", { secret: SECRET, now: before }).ok).toBe(false);
  });

  it("refuses to sign with a short secret", () => {
    expect(() => signApproval(claims, "short")).toThrow(/32 characters/);
  });
});
