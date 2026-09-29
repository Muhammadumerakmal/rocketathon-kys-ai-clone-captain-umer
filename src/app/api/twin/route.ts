import { run, withTrace } from "@openai/agents";
import { TwinChatRequest } from "@/contracts";
import { twinChatAgent } from "@/lib/ai/agents";
import { buildTwinContext } from "@/lib/ai/context";
import { configureAgents, TIMEOUTS } from "@/lib/ai/models";
import { SupabaseSession } from "@/lib/ai/session";
import { sseFromAgentStream } from "@/lib/ai/stream";
import { guardAiRequest, recordUsage } from "@/lib/budget";
import { isMock } from "@/lib/env";
import { HttpError, parseJson, withApi } from "@/lib/http";
import { fixtures, mockSseResponse } from "@/lib/mock";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Twin chat (plan §11.1): retrieve → layered prompt → streamed answer + evidence. */
export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, TwinChatRequest);
  if (isMock()) return mockSseResponse(fixtures.chatStream);

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

  const ctx = await buildTwinContext(supabase, user.id, { query: body.message, asOf: body.asOf });
  const session = new SupabaseSession(supabase, chatId, user.id);

  return withTrace("twin.chat", async () => {
    const result = await run(twinChatAgent(ctx), body.message, {
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
      onComplete: () => recordUsage(supabase, result.state.usage),
    });
  });
});
