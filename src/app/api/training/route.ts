import { TrainingAnswerRequest } from "@/contracts";
import { isMock } from "@/lib/env";
import { HttpError, parseJson, withApi } from "@/lib/http";
import { mockAnswers, mockState } from "@/lib/mock/store";
import { requireUser } from "@/lib/supabase/server";
import { trainingProgress } from "@/lib/training/progress";
import { QUESTION_BANK } from "@/lib/training/questions";
import { insertMemory } from "@/server/repos/memories";
import { snapshotTraits, upsertTraits } from "@/server/repos/traits";
import { listAnswers, listQuestions, saveAnswer } from "@/server/repos/training";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  if (isMock()) return Response.json(trainingProgress(QUESTION_BANK, mockAnswers()));
  const { supabase } = await requireUser();
  const [questions, answers] = await Promise.all([listQuestions(supabase), listAnswers(supabase)]);
  return Response.json(trainingProgress(questions, answers));
});

/** Save one answer, recompute stated Decision DNA deterministically (no model). */
export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, TrainingAnswerRequest);

  if (isMock()) {
    const q = QUESTION_BANK.find((x) => x.id === body.questionId);
    if (!q?.options.some((o) => o.id === body.optionId)) throw new HttpError("bad_request", "Unknown question or option.");
    mockState().answers.set(`${body.questionId}:${body.attempt}`, body);
    return Response.json(trainingProgress(QUESTION_BANK, mockAnswers()));
  }

  const { supabase, user } = await requireUser();
  const questions = await listQuestions(supabase);
  const question = questions.find((q) => q.id === body.questionId);
  const option = question?.options.find((o) => o.id === body.optionId);
  if (!question || !option) throw new HttpError("bad_request", "Unknown question or option.");
  if (body.attempt === 2 && !question.isRetest) throw new HttpError("bad_request", "Only retest questions have a second attempt.");

  const before = await listAnswers(supabase);
  const firstTime = !before.some((a) => a.questionId === body.questionId && a.attempt === body.attempt);

  await saveAnswer(supabase, user.id, body);
  const progress = trainingProgress(questions, await listAnswers(supabase));
  await upsertTraits(supabase, user.id, progress.traits.filter((t) => t.sampleCount > 0));

  if (body.attempt === 1 && firstTime) {
    // The answer is also a procedural memory the twin can retrieve later.
    await insertMemory(supabase, user.id, {
      content: `${question.question.replace(/…$/, "")} → ${option.label}`,
      kind: "procedural",
      sourceType: "quiz",
      sourceRef: question.slug,
      importance: 0.6,
    });
  }
  if (!progress.next) await snapshotTraits(supabase, user.id, progress.traits);

  return Response.json(progress);
});
