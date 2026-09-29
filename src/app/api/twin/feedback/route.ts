import { AnswerFeedbackRequest } from "@/contracts";
import { knownPreferenceKeys } from "@/lib/ai/context";
import { applyLearning, emptyUpdate, extractLearning } from "@/lib/ai/learning.server";
import { CONFIDENCE } from "@/lib/ai/learning";
import { guardAiRequest, recordUsage } from "@/lib/budget";
import { isMock } from "@/lib/env";
import { parseJson, withApi } from "@/lib/http";
import { mockAnswerFeedback } from "@/lib/mock/chat";
import { requireUser } from "@/lib/supabase/server";
import { adjustConfidence } from "@/server/repos/memories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DELTA = { exactly: CONFIDENCE.reinforce, mostly: CONFIDENCE.reinforce / 2, wrong: CONFIDENCE.contradict } as const;

/**
 * Exactly / Mostly right / Wrong on a personalized answer (Human AI Twin spec §9, §40).
 * The memories that produced the answer gain or lose confidence; a correction is learned as
 * a strong, explicit signal that supersedes what the twin got wrong.
 */
export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, AnswerFeedbackRequest);
  if (isMock()) return Response.json({ update: mockAnswerFeedback(body) });

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("message_feedback").insert({
    user_id: user.id,
    chat_id: body.chatId,
    answer_excerpt: body.answerExcerpt,
    rating: body.rating,
    correction: body.correction ?? null,
    memory_ids_used: body.memoryIds,
  });
  if (error) throw error;

  await adjustConfidence(supabase, body.memoryIds, DELTA[body.rating]);

  let update = emptyUpdate();
  if (body.correction && body.rating !== "exactly") {
    await guardAiRequest(supabase, user.id);
    const keys = await knownPreferenceKeys(supabase);
    const learned = await extractLearning(body.correction, keys);
    await recordUsage(supabase, learned.usage);
    update = await applyLearning(supabase, user.id, learned.learning, "feedback", `Correction: ${body.correction}`.slice(0, 300));
  }
  return Response.json({ update });
});
