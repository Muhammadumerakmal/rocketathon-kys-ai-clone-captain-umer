import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrainingQuestion } from "@/contracts";

interface QuestionRow {
  id: string;
  slug: string;
  question: string;
  category: TrainingQuestion["category"];
  options: TrainingQuestion["options"];
  is_retest: boolean;
}

export async function listQuestions(sb: SupabaseClient): Promise<TrainingQuestion[]> {
  const { data, error } = await sb
    .from("training_questions")
    .select("id,slug,question,category,options,is_retest")
    .order("sort_order")
    .returns<QuestionRow[]>();
  if (error) throw error;
  return data.map((r) => ({ id: r.id, slug: r.slug, question: r.question, category: r.category, options: r.options, isRetest: r.is_retest }));
}

export interface AnswerRecord {
  questionId: string;
  optionId: string;
  attempt: 1 | 2;
}

export async function listAnswers(sb: SupabaseClient): Promise<AnswerRecord[]> {
  const { data, error } = await sb
    .from("training_answers")
    .select("question_id,option_id,attempt")
    .returns<{ question_id: string; option_id: string; attempt: 1 | 2 }[]>();
  if (error) throw error;
  return data.map((r) => ({ questionId: r.question_id, optionId: r.option_id, attempt: r.attempt }));
}

export async function saveAnswer(sb: SupabaseClient, userId: string, a: AnswerRecord): Promise<void> {
  const { error } = await sb.from("training_answers").upsert(
    { user_id: userId, question_id: a.questionId, option_id: a.optionId, attempt: a.attempt, answered_at: new Date().toISOString() },
    { onConflict: "user_id,question_id,attempt" },
  );
  if (error) throw error;
}
