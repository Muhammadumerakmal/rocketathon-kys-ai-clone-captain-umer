import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnswerFeedbackRequest } from "@/contracts";

export async function insertMessageFeedback(sb: SupabaseClient, userId: string, feedback: AnswerFeedbackRequest): Promise<void> {
  const { error } = await sb.from("message_feedback").insert({
    user_id: userId,
    chat_id: feedback.chatId,
    answer_excerpt: feedback.answerExcerpt,
    rating: feedback.rating,
    correction: feedback.correction ?? null,
    memory_ids_used: feedback.memoryIds,
  });
  if (error) throw error;
}
