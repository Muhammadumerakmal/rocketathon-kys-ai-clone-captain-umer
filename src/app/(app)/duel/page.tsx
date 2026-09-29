import type { Metadata } from "next";
import { DuelBoard } from "@/features/duel/duel-board";
import { requireViewer } from "@/lib/auth";
import { nextScenario, publicScenario } from "@/lib/duel/scenarios";
import { scoreboard } from "@/lib/duel/score";
import { mockState } from "@/lib/mock/store";
import { listRounds } from "@/server/repos/duel";
import { loadShell } from "@/server/shell";

export const metadata: Metadata = { title: "Predict me" };

/** Your twin needs ≥ 2 known decision dimensions before a duel means anything. */
const MIN_READINESS = 2 / 8;

export default async function DuelPage() {
  const viewer = await requireViewer();
  const [rounds, shell] = await Promise.all([
    viewer.mode === "mock" ? Promise.resolve(mockState().duelRounds) : listRounds(viewer.supabase),
    loadShell(viewer),
  ]);
  const played = new Set(rounds.map((r) => r.scenario.id));

  return (
    <div className="space-y-5">
      <header className="mx-auto max-w-3xl">
        <h1 className="font-display text-[clamp(30px,8vw,44px)] font-bold leading-tight">Predict me</h1>
        <p className="mt-1 text-muted">You answer in secret. Your twin and a stranger answer too. Does your twin actually know you?</p>
      </header>
      <DuelBoard scenario={publicScenario(nextScenario(played))} board={scoreboard(rounds)} ready={shell.readiness >= MIN_READINESS} />
    </div>
  );
}
