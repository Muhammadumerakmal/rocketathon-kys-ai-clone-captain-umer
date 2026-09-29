import { run, withTrace } from "@openai/agents";
import { TwinChatRequest, type TwinStreamEvent } from "@/contracts";
import { twinChatAgent } from "@/lib/ai/agents";
import { buildTwinContext } from "@/lib/ai/context";
import { configureAgents, TIMEOUTS } from "@/lib/ai/models";
import { SupabaseSession } from "@/lib/ai/session";
import { sseFromAgentStream } from "@/lib/ai/stream";
import { focusBlockTool, neverExecute } from "@/lib/ai/tools";
import { guardAiRequest, recordUsage } from "@/lib/budget";
import { createProposal, isCalendarConnected } from "@/lib/connectors/gateway";
import { isMock } from "@/lib/env";
import { HttpError, parseJson, withApi } from "@/lib/http";
import { fixtures, mockSseResponse } from "@/lib/mock";
import { mockProposalStream, NOT_CONNECTED, wantsScheduling } from "@/lib/mock/connectors";
import { mockState } from "@/lib/mock/store";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Twin chat (plan §11.1): retrieve → layered prompt → streamed answer + evidence (+ approvals, §14). */
export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, TwinChatRequest);
  if (isMock()) {
    if (!wantsScheduling(body.message)) return mockSseResponse(fixtures.chatStream);
    return mockSseResponse(mockState().calendarConnected ? mockProposalStream(body.message) : NOT_CONNECTED);
  }

  const { supabase, user } = await requireUser();
  await guardAiRequest(supabase, user.id);
  configureAgents();

  let chatId = body.chatId;
  if (!chatId) {
    const { data, error } = await supabase
      .from("chats")
      .insert({ user_id: user.id, title: body.message.slice(0, 80) })
      .select("id")
      .single<{ id: string }>();
    if (error) throw error;
    chatId = data.id;
  } else {
    const { data } = await supabase.from("chats").select("id").eq("id", chatId).maybeSingle();
    if (!data) throw new HttpError("not_found", "Chat not found.");
  }

  const [ctx, canSchedule] = await Promise.all([
    buildTwinContext(supabase, user.id, { query: body.message, asOf: body.asOf }),
    isCalendarConnected(supabase),
  ]);
  const session = new SupabaseSession(supabase, chatId, user.id);
  // Least privilege: the write tool exists only for users who connected a calendar.
  const agent = twinChatAgent(ctx, canSchedule ? [focusBlockTool(neverExecute)] : []);

  return withTrace("twin.chat", async () => {
    const result = await run(agent, body.message, {
      stream: true,
      session,
      maxTurns: 3,
      signal: AbortSignal.timeout(TIMEOUTS.chat),
    });
    return sseFromAgentStream(result, {
      userMessage: body.message,
      before: [
        { type: "meta", chatId },
        { type: "evidence", evidence: ctx.evidence.slice(0, 6) },
      ],
      onComplete: async () => {
        await recordUsage(supabase, result.state.usage);
        const pending = result.interruptions[0];
        if (!pending) return [];
        // Paused on the approval-gated tool: store the run server-side, send only id + token.
        const raw = pending.rawItem as { arguments?: string };
        const proposal = await createProposal({
          userId: user.id,
          chatId,
          serializedState: result.state.toString(),
          rawArguments: raw.arguments ?? "{}",
          connector: "demo-calendar",
        });
        const event: TwinStreamEvent = { type: "approval_required", ...proposal };
        return [event];
      },
    });
  });
});
