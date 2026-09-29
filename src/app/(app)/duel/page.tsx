import type { Metadata } from "next";
import { DuelGame } from "@/features/duel/duel-game";
import { requireViewer } from "@/lib/auth";
import { nextScenario, publicScenario } from "@/lib/duel/scenarios";
import { scoreboard } from "@/lib/duel/score";
import { mockState } from "@/lib/mock/store";
import { listRounds } from "@/server/repos/duel";

export const metadata: Metadata = { title: "Predict Me" };

export default async function DuelPage() {
  const viewer = await requireViewer();
  const rounds = viewer.mode === "mock" ? mockState().duelRounds : await listRounds(viewer.supabase);
  const played = new Set(rounds.map((r) => r.scenario.id));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Predict Me</h1>
        <p className="mt-1 text-sm text-muted">
          You answer in secret. Your twin and a stranger with no data about you answer too. Does your twin actually know you?
        </p>
      </header>
      <DuelGame initial={{ next: publicScenario(nextScenario(played)), scoreboard: scoreboard(rounds), rounds: rounds.slice(0, 10) }} />
    </div>
  );
}
