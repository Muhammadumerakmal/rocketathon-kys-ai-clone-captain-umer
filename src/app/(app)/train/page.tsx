import type { Metadata } from "next";
import { Quiz } from "@/features/training/quiz";
import { requireViewer } from "@/lib/auth";
import { mockAnswers } from "@/lib/mock/store";
import { trainingProgress } from "@/lib/training/progress";
import { QUESTION_BANK } from "@/lib/training/questions";
import { listAnswers, listQuestions } from "@/server/repos/training";

export const metadata: Metadata = { title: "Train" };

export default async function TrainPage() {
  const viewer = await requireViewer();
  const progress =
    viewer.mode === "mock"
      ? trainingProgress(QUESTION_BANK, mockAnswers())
      : trainingProgress(...(await Promise.all([listQuestions(viewer.supabase), listAnswers(viewer.supabase)])));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Train your twin</h1>
        <p className="mt-1 text-sm text-muted">
          Quick gut answers work best. There are no right answers — only yours. Use keys 1–5.
        </p>
      </header>
      <Quiz initial={progress} />
    </div>
  );
}
