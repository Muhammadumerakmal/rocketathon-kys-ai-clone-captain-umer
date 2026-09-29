import { run, withTrace } from "@openai/agents";
import { TwinChatRequest, type TwinStreamEvent } from "@/contracts";
import { twinChatAgent } from "@/lib/ai/agents";
import { buildTwinContext, knownPreferenceKeys } from "@/lib/ai/context";
import { applyLearning, extractLearning } from "@/lib/ai/learning.server";
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
import { adjustConfidence } from "@/server/repos/memories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ask (Human AI Twin spec §25): authenticate → validate → load conversation → retrieve
 * (relevance-gated) → rank → build context → stream the answer → persist → extract learning
 * → validate/dedupe → update the twin. Learning runs IN PARALLEL with the reply, so it never
 * slows the answer, and it's applied quietly (surfaced only for explicit commands/corrections).
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
    if (!data) throw new HttpError("not_found", "Conversation not found.");
  }
  const threadId = chatId;

  return sseResponse<TwinStreamEvent>(
    (send) =>
      withTrace("twin.chat", async () => {
        send({ type: "meta", chatId: threadId });

        // Start learning immediately: it only needs the message (+ existing keys to reuse).
        const learning = knownPreferenceKeys(supabase).then((keys) => extractLearning(body.message, keys));

        send({ type: "status", step: "retrieving" });
        const [ctx, canSchedule] = await Promise.all([
          buildTwinContext(supabase, user.id, { query: body.message, asOf: body.asOf }),
          isCalendarConnected(supabase),
        ]);
        // Only genuinely relevant memories get here (similarity-gated). None → answer normally.
        if (ctx.memories.length > 0) {
          send({
            type: "personalized",
            memories: ctx.memories.slice(0, 6).map((m) => ({
              id: m.id,
              label: m.content.length > 140 ? `${m.content.slice(0, 137)}…` : m.content,
              category: m.category ?? "other",
              confidence: m.confidence ?? 0.6,
            })),
          });
        }

        const agent = twinChatAgent(ctx, canSchedule ? [focusBlockTool(neverExecute)] : []);
        const result = await run(agent, body.message, {
          stream: true,
          session: new SupabaseSession(supabase, threadId, user.id),
          maxTurns: 3,
          signal: AbortSignal.timeout(TIMEOUTS.chat),
        });
        await pipeAgentText(result, send);
        await recordUsage(supabase, result.state.usage);
        await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
        if (ctx.memories.length > 0) await adjustConfidence(supabase, ctx.memories.map((m) => m.id), 0).catch(() => undefined); // last_used_at

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

        const learned = await learning;
        await recordUsage(supabase, learned.usage);
        const update = await applyLearning(supabase, user.id, learned.learning, "conversation", body.message.slice(0, 300)).catch((err) => {
          console.warn("[learning] apply failed", err instanceof Error ? err.message : err);
          return null;
        });
        // Learn quietly; only tell the user when they asked (remember / forget) — spec §29.
        if (update && update.explicit && (update.saved.length || update.replaced.length || update.forgotten.length || update.reinforced.length)) {
          send({ type: "memory_update", update });
        }
      }),
    { userMessage: body.message },
  );
});
