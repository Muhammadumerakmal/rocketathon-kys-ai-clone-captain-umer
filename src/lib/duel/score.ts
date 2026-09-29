import type { DuelRound, DuelScoreboard } from "@/contracts";
import { liftPts } from "@/lib/ai/confidence";

export function scoreboard(rounds: readonly DuelRound[]): DuelScoreboard {
  const twinHits = rounds.filter((r) => r.twinMatched).length;
  const baselineHits = rounds.filter((r) => r.baselineMatched).length;
  return { rounds: rounds.length, twinHits, baselineHits, liftPts: liftPts(twinHits, baselineHits, rounds.length) };
}
