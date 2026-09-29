import "server-only";
import type { DecisionCategory } from "@/contracts";
import { brier } from "@/lib/ai/confidence";
import { computeDashboard, type CategoryRow, type DashboardData } from "@/lib/analytics/dashboard";
import type { Viewer } from "@/lib/auth";
import { revealedWeights } from "@/lib/duel/scenarios";
import { mockAnswers, mockState } from "@/lib/mock/store";
import { trainingProgress } from "@/lib/training/progress";
import { QUESTION_BANK } from "@/lib/training/questions";
import { scoreTraits } from "@/lib/training/score";
import { calibrationStats, reliabilityPoints } from "./repos/predictions";
import { openRevisions } from "./repos/revisions";
import { getTraits } from "./repos/traits";
import { listAnswers, listQuestions } from "./repos/training";

/** Gathers dashboard inputs for either mode, then runs the pure computation. */
export async function loadDashboard(viewer: Viewer): Promise<DashboardData> {
  if (viewer.mode === "mock") {
    const s = mockState();
    const progress = trainingProgress(QUESTION_BANK, mockAnswers());
    // Duel rounds count as resolved predictions (their confidence = top vote share).
    const duelPoints = s.duelRounds.map((r) => ({
      category: r.scenario.category,
      confidence: Math.min(0.95, Math.max(0.05, Math.max(...Object.values(r.twinDistribution)))),
      twinCorrect: r.twinMatched,
      baselineCorrect: r.baselineMatched,
    }));
    const all = [
      ...s.resolutions.map((r) => ({ category: r.category, confidence: r.confidence, twinCorrect: r.twinCorrect, baselineCorrect: r.baselineCorrect })),
      ...duelPoints,
    ];
    const byCat = new Map<DecisionCategory, CategoryRow>();
    for (const p of all) {
      const row = byCat.get(p.category) ?? { category: p.category, n: 0, hits: 0, brierSum: 0, baselineHits: 0 };
      row.n += 1;
      row.hits += Number(p.twinCorrect);
      row.baselineHits += Number(p.baselineCorrect);
      row.brierSum += brier(p.confidence, p.twinCorrect);
      byCat.set(p.category, row);
    }
    const revealed = scoreTraits(
      revealedWeights(s.duelRounds.map((r) => ({ scenarioId: r.scenario.id, userChoice: r.userChoice }))),
      "revealed",
    );
    return computeDashboard({
      stated: progress.traits,
      revealed,
      categories: [...byCat.values()],
      points: all.map((p) => ({ confidence: p.confidence, correct: p.twinCorrect })),
      ceiling: progress.ceiling,
      memoryCount: s.memories.length,
      openRevisions: s.revisions.length,
    });
  }

  const sb = viewer.supabase;
  const [traits, categories, points, revisions, questions, answers, memCount] = await Promise.all([
    getTraits(sb),
    calibrationStats(sb),
    reliabilityPoints(sb),
    openRevisions(sb),
    listQuestions(sb),
    listAnswers(sb),
    sb.from("memories").select("id", { count: "exact", head: true }),
  ]);
  return computeDashboard({
    stated: traits.stated.length ? traits.stated : trainingProgress(questions, answers).traits,
    revealed: traits.revealed,
    categories,
    points,
    ceiling: trainingProgress(questions, answers).ceiling,
    memoryCount: memCount.count ?? 0,
    openRevisions: revisions.length,
  });
}
