import { describe, expect, it } from "vitest";
import { FocusBlockArgs } from "@/contracts";
import { demoCalendar } from "@/lib/connectors/adapter";
import { hashArgs, signApproval } from "@/lib/connectors/hmac";
import { checkProposal, focusBlockEnd, summarizeFocusBlock, type StoredProposal } from "@/lib/connectors/policy";

const SECRET = "s".repeat(40);
const USER = "00000000-0000-4000-8000-00000000000a";
const args = { title: "Focus: hackathon prep", start: "2026-09-30T09:00:00.000Z", minutes: 45 };
const proposal: StoredProposal = {
  id: "00000000-0000-4000-8000-0000000000a1",
  userId: USER,
  status: "proposed",
  arguments: args,
  argsHash: hashArgs(args),
  expiresAt: "2026-09-29T12:15:00.000Z",
};
const token = signApproval({ proposalId: proposal.id, userId: USER, argsHash: proposal.argsHash, expiresAt: proposal.expiresAt }, SECRET);
const now = new Date("2026-09-29T12:00:00.000Z");

describe("checkProposal (approval state machine guard)", () => {
  it("accepts a pending, signed, unexpired proposal", () => {
    expect(checkProposal(proposal, token, USER, { secret: SECRET, now })).toEqual({ ok: true });
  });

  it("rejects arguments edited after signing", () => {
    const tampered = { ...proposal, arguments: { ...args, minutes: 180 } };
    expect(checkProposal(tampered, token, USER, { secret: SECRET, now })).toEqual({ ok: false, reason: "tampered_args" });
  });

  it("rejects another user replaying the token", () => {
    expect(checkProposal(proposal, token, "00000000-0000-4000-8000-00000000000b", { secret: SECRET, now }).ok).toBe(false);
  });

  it("rejects expired, already-decided, and forged tokens", () => {
    expect(checkProposal(proposal, token, USER, { secret: SECRET, now: new Date("2026-09-29T12:16:00Z") })).toEqual({ ok: false, reason: "expired" });
    expect(checkProposal({ ...proposal, status: "executed" }, token, USER, { secret: SECRET, now })).toEqual({ ok: false, reason: "not_pending" });
    expect(checkProposal(proposal, "0".repeat(64), USER, { secret: SECRET, now })).toEqual({ ok: false, reason: "bad_signature" });
  });
});

describe("focus block", () => {
  it("validates tool arguments (15–180 minutes, ISO start)", () => {
    expect(FocusBlockArgs.safeParse(args).success).toBe(true);
    expect(FocusBlockArgs.safeParse({ ...args, minutes: 600 }).success).toBe(false);
    expect(FocusBlockArgs.safeParse({ ...args, start: "tomorrow 9am" }).success).toBe(false);
  });

  it("summarizes exactly what will happen and computes the end", () => {
    expect(summarizeFocusBlock(args)).toBe('Create a 45-minute calendar event "Focus: hackathon prep" starting 2026-09-30T09:00:00.000Z');
    expect(focusBlockEnd(args)).toBe("2026-09-30T09:45:00.000Z");
  });

  it("the demo calendar creates the approved event", async () => {
    const r = await demoCalendar.execute("create_focus_block", args);
    expect(r).toMatchObject({ title: args.title, start: args.start, end: "2026-09-30T09:45:00.000Z" });
  });
});
