import type { Metadata } from "next";
import { SwipeDeck } from "@/features/training/swipe-deck";
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
    <div className="space-y-5">
      <header className="mx-auto max-w-md">
        <h1 className="font-display text-[clamp(30px,8vw,44px)] font-bold leading-tight">Train your twin</h1>
        <p className="mt-1 text-muted">Swipe, tap, or use ← → keys. Quick gut answers work best.</p>
      </header>
      <SwipeDeck initial={progress} />
    </div>
  );
}
