"use client";

import { Check, EyeOff, UserRound, Users, X } from "lucide-react";
import { useState } from "react";
import type { DuelRound, DuelScenario, DuelScoreboard } from "@/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { postJson } from "@/lib/fetcher";
import { cn, pct } from "@/lib/utils";

interface DuelState {
  next: DuelScenario;
  scoreboard: DuelScoreboard;
  rounds: DuelRound[];
}

export function DuelGame({ initial }: { initial: DuelState }) {
  const [game, setGame] = useState(initial);
  const [secret, setSecret] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<DuelRound | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scenario = revealed?.scenario ?? game.next;

  async function reveal() {
    if (!secret) return;
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<DuelState & { round: DuelRound }>("/api/duel", { scenarioId: game.next.id, userChoice: secret });
      setRevealed(res.round);
      setGame({ next: res.next, scoreboard: res.scoreboard, rounds: res.rounds });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Round failed.");
    } finally {
      setLoading(false);
    }
  }

  function nextRound() {
    setRevealed(null);
    setSecret(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <Card className="space-y-5">
        <div className="flex items-center justify-between">
          <Badge>{scenario.category}</Badge>
          <span className="text-xs text-muted">Round {game.scoreboard.rounds + (revealed ? 0 : 1)}</span>
        </div>
        <h2 className="text-lg font-semibold">{scenario.scenario}</h2>

        {!revealed ? (
          <>
            <p className="flex items-center gap-2 text-sm text-muted">
              <EyeOff className="size-4" aria-hidden /> Pick what you&apos;d really do. Your twin can&apos;t see it.
            </p>
            <div className="grid gap-2" role="radiogroup" aria-label="Your secret choice">
              {scenario.options.map((o) => (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={secret === o}
                  onClick={() => setSecret(o)}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                    secret === o ? "border-twin bg-twin/10 font-medium" : "border-border hover:border-twin/60",
                  )}
                >
                  {secret === o ? "●" : "○"} {o}
                </button>
              ))}
            </div>
            <Button onClick={reveal} disabled={!secret || loading} size="lg" className="w-full">
              {loading ? "Your twin is thinking…" : "Lock in & reveal"}
            </Button>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <RevealTile label="You" icon={<Check className="size-4" />} choice={revealed.userChoice} tone="you" />
              <RevealTile label="Your twin" icon={<UserRound className="size-4" />} choice={revealed.twinChoice} tone={revealed.twinMatched ? "hit" : "miss"} />
              <RevealTile label="A stranger" icon={<Users className="size-4" />} choice={revealed.baselineChoice} tone={revealed.baselineMatched ? "hit" : "miss"} />
            </div>
            <p className="text-sm font-medium" role="status">
              {revealed.twinMatched && !revealed.baselineMatched && "Your twin knew you — a stranger didn't. 🎯"}
              {revealed.twinMatched && revealed.baselineMatched && "Both got it — this one was a generic answer."}
              {!revealed.twinMatched && revealed.baselineMatched && "The stranger won this one. Your twin just learned something."}
              {!revealed.twinMatched && !revealed.baselineMatched && "You surprised everyone."}
            </p>
            <div className="text-xs text-muted">
              Twin&apos;s runs:{" "}
              {Object.entries(revealed.twinDistribution)
                .map(([o, s]) => `${o} ${pct(s)}`)
                .join(" · ")}
            </div>
            <Button onClick={nextRound} className="w-full">
              Next round
            </Button>
          </>
        )}
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </Card>

      <Scoreboard board={game.scoreboard} />
    </div>
  );
}

function RevealTile({ label, icon, choice, tone }: { label: string; icon: React.ReactNode; choice: string; tone: "you" | "hit" | "miss" }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        tone === "you" && "border-twin/40 bg-twin/5",
        tone === "hit" && "border-success/50 bg-success/10",
        tone === "miss" && "border-border bg-surface-2",
      )}
    >
      <p className="flex items-center gap-1 text-xs text-muted">
        {icon} {label} {tone === "hit" && <Check className="size-3 text-success" aria-label="matched" />}
        {tone === "miss" && <X className="size-3" aria-label="missed" />}
      </p>
      <p className="mt-1 text-sm font-medium">{choice}</p>
    </div>
  );
}

export function Scoreboard({ board }: { board: DuelScoreboard }) {
  const rate = (hits: number) => (board.rounds ? hits / board.rounds : 0);
  return (
    <Card className="space-y-4 self-start">
      <div>
        <CardDescription>Personalization lift</CardDescription>
        <p className={cn("text-3xl font-semibold tabular-nums", board.liftPts > 0 ? "text-twin" : "text-muted")}>
          {board.liftPts > 0 ? "+" : ""}
          {board.liftPts} pts
        </p>
        <CardDescription>twin vs stranger over {board.rounds} rounds</CardDescription>
      </div>
      {[
        { label: "Twin", hits: board.twinHits, cls: "bg-twin" },
        { label: "Stranger", hits: board.baselineHits, cls: "bg-stranger" },
      ].map((row) => (
        <div key={row.label}>
          <div className="flex justify-between text-sm">
            <span>{row.label}</span>
            <span className="tabular-nums text-muted">
              {row.hits}/{board.rounds}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface-2">
            <div className={cn("h-2 rounded-full transition-all", row.cls)} style={{ width: pct(rate(row.hits)) }} />
          </div>
        </div>
      ))}
    </Card>
  );
}
