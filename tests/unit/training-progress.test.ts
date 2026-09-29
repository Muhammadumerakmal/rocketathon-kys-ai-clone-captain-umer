import { describe, expect, it } from "vitest";
import { trainingProgress, type AnswerLike } from "@/lib/training/progress";
import { QUESTION_BANK } from "@/lib/training/questions";

const firstOption = (i: number) => QUESTION_BANK[i]!.options[0]!.id;
const answerAll = (): AnswerLike[] => QUESTION_BANK.map((q, i) => ({ questionId: q.id, optionId: firstOption(i), attempt: 1 }));

describe("trainingProgress", () => {
  it("starts at the first question with nothing known", () => {
    const p = trainingProgress(QUESTION_BANK, []);
    expect(p.next).toEqual({ question: QUESTION_BANK[0], attempt: 1 });
    expect(p.readiness.known).toBe(0);
    expect(p.ceiling).toBeNull();
  });

  it("serves retest questions only after every first attempt", () => {
    const answers = answerAll().slice(0, -1);
    expect(trainingProgress(QUESTION_BANK, answers).next?.attempt).toBe(1);
    const p = trainingProgress(QUESTION_BANK, answerAll());
    expect(p.next?.attempt).toBe(2);
    expect(p.next?.question.isRetest).toBe(true);
    expect(p.readiness.known).toBe(8);
  });

  it("computes the consistency ceiling from retest pairs and finishes", () => {
    const retests = QUESTION_BANK.filter((q) => q.isRetest);
    const second: AnswerLike[] = retests.map((q, i) => ({
      questionId: q.id,
      // change the answer on the first retest only → 4/5 consistent
      optionId: i === 0 ? q.options[1]!.id : q.options[0]!.id,
      attempt: 2,
    }));
    const p = trainingProgress(QUESTION_BANK, [...answerAll(), ...second]);
    expect(p.ceiling).toBeCloseTo(0.8);
    expect(p.next).toBeNull();
    expect(p.retestsDone).toBe(5);
  });

  it("ignores answers pointing at unknown options", () => {
    const p = trainingProgress(QUESTION_BANK, [{ questionId: QUESTION_BANK[0]!.id, optionId: "nope", attempt: 1 }]);
    expect(p.readiness.known).toBe(0);
  });
});
