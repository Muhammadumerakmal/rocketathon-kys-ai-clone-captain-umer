import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";

/** demo-calendar: built-in calendar (no OAuth) behind the same adapter interface as Google. */
export const ConnectorId = z.enum(["demo-calendar", "google-calendar"]);
export type ConnectorId = z.infer<typeof ConnectorId>;

export const ProposalStatus = z.enum([
  "proposed",
  "approved",
  "rejected",
  "executed",
  "failed",
  "expired",
]);
export type ProposalStatus = z.infer<typeof ProposalStatus>;

export const ActionProposal = z.object({
  id: Uuid,
  connector: ConnectorId,
  action: z.string(),
  arguments: z.record(z.string(), z.unknown()),
  /** human-readable exact summary shown on the approval card */
  summary: z.string(),
  status: ProposalStatus,
  expiresAt: IsoDateTime,
});
export type ActionProposal = z.infer<typeof ActionProposal>;

/** The browser only ever gets the proposal id + HMAC token, never the RunState (§10). */
export const ApprovalDecision = z.object({
  proposalId: Uuid,
  token: z.string().regex(/^[a-f0-9]{64}$/),
  decision: z.enum(["approve", "reject"]),
});
export type ApprovalDecision = z.infer<typeof ApprovalDecision>;

export const ActionResult = z.object({
  proposalId: Uuid,
  status: ProposalStatus,
  result: z.record(z.string(), z.unknown()).nullable(),
});
export type ActionResult = z.infer<typeof ActionResult>;

export const FocusBlockArgs = z.object({
  title: z.string().max(80),
  start: IsoDateTime,
  minutes: z.number().int().min(15).max(180),
});
export type FocusBlockArgs = z.infer<typeof FocusBlockArgs>;
