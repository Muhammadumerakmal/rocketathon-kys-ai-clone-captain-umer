import type { TraitScore, TrainingQuestion } from "@/contracts";
import { consistencyCeiling, readiness, scoreTraits } from "./score";

export interface AnswerLike {
  questionId: string;
  optionId: string;
  attempt: 1 | 2;
}

export interface TrainingProgress {
  answered: number;
  total: number;
  retestsDone: number;
  retestsTotal: number;
  traits: TraitScore[];
  readiness: { known: number; total: number };
  /** share of retest questions answered the same way twice; null until one exists */
  ceiling: number | null;
  /** next question to show, attempt 1 first, then retests (shuffled order) */
  next: { question: TrainingQuestion; attempt: 1 | 2 } | null;
  /** every remaining card in order (the swipe deck renders the top three) */
  queue: { question: TrainingQuestion; attempt: 1 | 2 }[];
}

/** Pure: everything the Train page and the dashboard need from answers. */
export function trainingProgress(questions: readonly TrainingQuestion[], answers: readonly AnswerLike[]): TrainingProgress {
  const first = new Map(answers.filter((a) => a.attempt === 1).map((a) => [a.questionId, a.optionId]));
  const second = new Map(answers.filter((a) => a.attempt === 2).map((a) => [a.questionId, a.optionId]));

  const answeredOptions = questions.flatMap((q) => {
    const optionId = first.get(q.id);
    const option = q.options.find((o) => o.id === optionId);
    return option ? [{ questionId: q.id, weights: option.weights }] : [];
  });
  const traits = scoreTraits(answeredOptions, "stated");

  const retests = questions.filter((q) => q.isRetest);
  const pairs = retests.flatMap((q) => {
    const a = first.get(q.id);
    const b = second.get(q.id);
    return a && b ? [{ first: a, second: b }] : [];
  });

  // All first attempts (in order) come before any retest, so a retest can never precede its
  // own first answer. Retests run in reverse so they don't feel like an immediate repeat.
  const queue = [
    ...questions.filter((q) => !first.has(q.id)).map((question) => ({ question, attempt: 1 as const })),
    ...[...retests].reverse().filter((q) => !second.has(q.id)).map((question) => ({ question, attempt: 2 as const })),
  ];
  const next = queue[0] ?? null;

  return {
    answered: first.size,
    total: questions.length,
    retestsDone: pairs.length,
    retestsTotal: retests.length,
    traits,
    readiness: readiness(traits),
    ceiling: consistencyCeiling(pairs),
    next,
    queue,
  };
}
