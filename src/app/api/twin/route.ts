import { run, withTrace } from "@openai/agents";
import { TwinChatRequest, type TwinStreamEvent } from "@/contracts";
import { twinChatAgent } from "@/lib/ai/agents";
import { buildTwinContext } from "@/lib/ai/context";
import { suggestMemories } from "@/lib/ai/memory-suggest.server";
import { configureAgents, TIMEOUTS } from "@/lib/ai/models";
import { SupabaseSession } from "@/lib/ai/session";
import { pipeAgentText, sseResponse } from "@/lib/ai/stream";
import { focusBlockTool, neverExecute } from "@/lib/ai/tools";
import { guardAiRequest, recordUsage } from "@/lib/budget";
import { createProposal, isCalendarConnected } from "@/lib/connectors/gateway";
import { isMock } from "@/lib/env";
import { HttpError, parseJson, withApi } from "@/lib/http";
import { mockChat } from "@/lib/mock/chat";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Twin chat (Ultra plan §11.1, UI/UX plan §6.4). Emits REAL progress: status → evidence →
 * text deltas → (approval_required) → (memory_suggestion) → done. The memory picker runs in
 * parallel with the reply, so it never slows the answer down.
 */
export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, TwinChatRequest);
  if (isMock()) return mockChat(body);

  // Auth + quota before the stream opens, so they're real HTTP 401 / 429s.
  const { supabase, user } = await requireUser();
  await guardAiRequest(supabase, user.id);
  configureAgents();

  let chatId = body.chatId;
  if (!chatId) {
    const { data, error } = await supabase.from("chats").insert({ user_id: user.id, title: body.message.slice(0, 80) }).select("id").single<{ id: string }>();
    if (error) throw error;
    chatId = data.id;
  } else {
    const { data } = await supabase.from("chats").select("id").eq("id", chatId).maybeSingle();
    if (!data) throw new HttpError("not_found", "Chat not found.");
  }
  const threadId = chatId;

  return sseResponse<TwinStreamEvent>(
    (send) =>
      withTrace("twin.chat", async () => {
        send({ type: "meta", chatId: threadId });
        send({ type: "status", step: "retrieving" });
        const [ctx, canSchedule] = await Promise.all([
          buildTwinContext(supabase, user.id, { query: body.message, asOf: body.asOf }),
          isCalendarConnected(supabase),
        ]);
        send({ type: "evidence", evidence: ctx.evidence.slice(0, 6) });

        // In parallel with the reply: propose durable facts from what the user just said.
        const picking = suggestMemories(body.message, ctx.memories.map((m) => m.content));

        const agent = twinChatAgent(ctx, canSchedule ? [focusBlockTool(neverExecute)] : []);
        const result = await run(agent, body.message, {
          stream: true,
          session: new SupabaseSession(supabase, threadId, user.id),
          maxTurns: 3,
          signal: AbortSignal.timeout(TIMEOUTS.chat),
        });
        await pipeAgentText(result, send);
        await recordUsage(supabase, result.state.usage);

        const pending = result.interruptions[0];
        if (pending) {
          // Paused on the approval-gated tool: run stored server-side, browser gets id + token only.
          const raw = pending.rawItem as { arguments?: string };
          const proposal = await createProposal({
            userId: user.id,
            chatId: threadId,
            serializedState: result.state.toString(),
            rawArguments: raw.arguments ?? "{}",
            connector: "demo-calendar",
          });
          send({ type: "approval_required", ...proposal });
        }

        const picked = await picking;
        await recordUsage(supabase, picked.usage);
        if (picked.suggestions.length > 0) send({ type: "memory_suggestion", suggestions: picked.suggestions });
      }),
    { userMessage: body.message },
  );
});
