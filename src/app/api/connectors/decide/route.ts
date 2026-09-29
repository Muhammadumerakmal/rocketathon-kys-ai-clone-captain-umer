import { ApprovalDecision } from "@/contracts";
import { twinChatAgent } from "@/lib/ai/agents";
import { buildTwinContext } from "@/lib/ai/context";
import { configureAgents } from "@/lib/ai/models";
import { focusBlockTool } from "@/lib/ai/tools";
import { guardAiRequest } from "@/lib/budget";
import { decideProposal } from "@/lib/connectors/gateway";
import { isMock } from "@/lib/env";
import { HttpError, parseJson, withApi } from "@/lib/http";
import { mockDecide } from "@/lib/mock/connectors";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Approve / reject a proposed action (plan §14). HMAC-verified; executes only on approve. */
export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, ApprovalDecision);

  if (isMock()) {
    const r = await mockDecide(body);
    if (!r) throw new HttpError("not_found", "Proposal not found.");
    if ("error" in r) throw new HttpError("forbidden", r.error === "expired" ? "This proposal expired. Ask your twin again." : "This approval is not valid.");
    return Response.json(r);
  }

  const { supabase, user } = await requireUser();
  await guardAiRequest(supabase, user.id);
  configureAgents();
  const result = await decideProposal({
    userId: user.id,
    proposalId: body.proposalId,
    token: body.token,
    decision: body.decision,
    // Rebuild the same agent (name + tool) the run paused on; only the executor differs.
    buildAgent: async (onExecute) => {
      const ctx = await buildTwinContext(supabase, user.id, { query: "calendar focus block" });
      return twinChatAgent(ctx, [focusBlockTool(onExecute)]);
    },
  });
  return Response.json(result);
});
