import "server-only";
import type { DecisionCategory } from "@/contracts";
import { brier } from "@/lib/ai/confidence";
import { computeDashboard, type CategoryRow, type DashboardData } from "@/lib/analytics/dashboard";
import type { LedgerEntry } from "@/lib/analytics/ledger";
import type { Viewer } from "@/lib/auth";
import { revealedWeights } from "@/lib/duel/scenarios";
import { mockAnswers, mockState } from "@/lib/mock/store";
import { trainingProgress } from "@/lib/training/progress";
import { QUESTION_BANK } from "@/lib/training/questions";
import { scoreTraits } from "@/lib/training/score";
import { calibrationStats, ledgerEntries, reliabilityPoints } from "./repos/predictions";
import { openRevisions } from "./repos/revisions";
import { getTraits } from "./repos/traits";
import { listAnswers, listQuestions } from "./repos/training";

export type InsightsData = DashboardData & { ledger: LedgerEntry[] };

/** Gathers Insights inputs for either mode, then runs the pure computation. */
export async function loadDashboard(viewer: Viewer): Promise<InsightsData> {
  if (viewer.mode === "mock") {
    const s = mockState();
    const progress = trainingProgress(QUESTION_BANK, mockAnswers());
    // One ledger: confirmed predictions AND duel rounds, each recorded once when resolved.
    const byCat = new Map<DecisionCategory, CategoryRow>();
    for (const r of s.resolutions) {
      const row = byCat.get(r.category) ?? { category: r.category, n: 0, hits: 0, brierSum: 0, baselineHits: 0 };
      row.n += 1;
      row.hits += Number(r.twinCorrect);
      row.baselineHits += Number(r.baselineCorrect);
      row.brierSum += brier(r.confidence, r.twinCorrect);
      byCat.set(r.category, row);
    }
    const revealed = scoreTraits(
      revealedWeights(s.duelRounds.map((r) => ({ scenarioId: r.scenario.id, userChoice: r.userChoice }))),
      "revealed",
    );
    const ledger = [...s.resolutions]
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((r) => ({ at: r.at, scenario: r.scenario, twinCorrect: r.twinCorrect, baselineCorrect: r.baselineCorrect }));
    return {
      ...computeDashboard({
        stated: progress.traits,
        revealed,
        categories: [...byCat.values()],
        points: s.resolutions.map((r) => ({ confidence: r.confidence, correct: r.twinCorrect })),
        ceiling: progress.ceiling,
        memoryCount: s.memories.length,
        openRevisions: s.revisions.length,
      }),
      ledger,
    };
  }

  const sb = viewer.supabase;
  const [traits, categories, points, revisions, questions, answers, memCount, ledger] = await Promise.all([
    getTraits(sb),
    calibrationStats(sb),
    reliabilityPoints(sb),
    openRevisions(sb),
    listQuestions(sb),
    listAnswers(sb),
    sb.from("memories").select("id", { count: "exact", head: true }),
    ledgerEntries(sb),
  ]);
  const progress = trainingProgress(questions, answers);
  return {
    ...computeDashboard({
      stated: traits.stated.length ? traits.stated : progress.traits,
      revealed: traits.revealed,
      categories,
      points,
      ceiling: progress.ceiling,
      memoryCount: memCount.count ?? 0,
      openRevisions: revisions.length,
    }),
    ledger,
  };
}
