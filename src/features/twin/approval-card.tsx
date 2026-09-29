"use client";

import { CalendarPlus, Check, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { postJson } from "@/lib/fetcher";
import { localizeSummary } from "@/lib/format";

type Outcome = { status: string; reply: string };

/** Human-in-the-loop gate (plan §14): the exact action, and nothing happens without a click. */
export function ApprovalCard({ approval }: { approval: { proposalId: string; token: string; summary: string } }) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setBusy(decision);
    setError(null);
    try {
      setOutcome(await postJson<Outcome>("/api/connectors/decide", { proposalId: approval.proposalId, token: approval.token, decision }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't record your decision.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-3 border-twin/40 p-3">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
        <CalendarPlus className="size-4" aria-hidden /> Your twin wants to act — approve?
      </p>
      <p className="text-sm font-medium">{localizeSummary(approval.summary)}</p>
      {outcome ? (
        <div className="space-y-1 text-sm" role="status">
          <p className="flex items-center gap-1.5">
            {outcome.status === "executed" ? <Check className="size-4 text-success" aria-hidden /> : <X className="size-4" aria-hidden />}
            {outcome.status === "executed" ? "Approved and created." : outcome.status === "rejected" ? "Rejected — nothing was created." : `Status: ${outcome.status}`}
          </p>
          {outcome.reply && <p className="text-muted">{outcome.reply}</p>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => decide("approve")} disabled={busy !== null}>
            {busy === "approve" ? "Creating…" : "Approve"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => decide("reject")} disabled={busy !== null}>
            Reject
          </Button>
          <span className="flex items-center gap-1 text-xs text-muted">
            <ShieldCheck className="size-3.5" aria-hidden /> Signed, expires in 15 min, logged in your audit trail
          </span>
        </div>
      )}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
