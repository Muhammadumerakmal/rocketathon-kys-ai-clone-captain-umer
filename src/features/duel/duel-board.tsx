"use client";

import { Check, Lock, UserRound, Users, X } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import type { DuelScenario, DuelScoreboard } from "@/contracts";
import { orb } from "@/components/twin-orb/orb-store";
import { TwinOrb } from "@/components/twin-orb/twin-orb";
import { Button, buttonVariants, Dots } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Odometer } from "@/components/ui/odometer";
import { toast } from "@/components/ui/toaster";
import { postJson } from "@/lib/fetcher";
import { springs } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { duelReducer, isThinking, TICK_MS, type DuelResult } from "./duel-machine";

/**
 * "Predict me" board (UI/UX plan §6.3). Answers are requested the moment you lock,
 * in parallel with the countdown, so the countdown hides model latency.
 */
export function DuelBoard({ scenario, board, ready }: { scenario: DuelScenario; board: DuelScoreboard; ready: boolean }) {
  const [s, dispatch] = useReducer(duelReducer, { phase: "choosing", scenario, choice: null, board });
  const reduced = useReducedMotion();
  const verdictRef = useRef<HTMLDivElement>(null);
  const [taught, setTaught] = useState(false);

  // countdown ticks while locked
  useEffect(() => {
    if (s.phase !== "locked" || s.count === 0) return;
    const t = setTimeout(() => dispatch({ type: "tick" }), TICK_MS);
    return () => clearTimeout(t);
  }, [s]);

  // reveal: orb reacts, verdict scrolls into view
  const revealedId = s.phase === "revealed" ? s.result.round.id : null;
  useEffect(() => {
    if (s.phase !== "revealed") return;
    if (s.result.round.twinMatched) orb.pulse();
    else orb.miss();
    verdictRef.current?.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react once per revealed round
  }, [revealedId]);

  async function lock() {
    if (s.phase !== "choosing" || !s.choice) return;
    dispatch({ type: "lock" });
    try {
      const res = await postJson<DuelResult & { scoreboard: DuelScoreboard; next: DuelScenario }>("/api/duel", {
        scenarioId: s.scenario.id,
        userChoice: s.choice,
      });
      dispatch({ type: "answers", result: { round: res.round, board: res.scoreboard, next: res.next } });
    } catch {
      dispatch({ type: "failed", message: "Couldn't get your twin's answer. Reveal again." });
    }
  }

  async function teach() {
    if (s.phase !== "revealed") return;
    setTaught(true);
    try {
      await postJson("/api/memory", {
        content: `When facing "${s.scenario.scenario}", I chose "${s.choice}".`,
        kind: "procedural",
      });
      toast.info("Your twin will remember that.");
    } catch {
      setTaught(false);
      toast.error("Couldn't save that. Try again.");
    }
  }

  if (!ready) {
    return (
      <section className="mx-auto max-w-md rounded-[var(--r-lg)] border border-line bg-surface p-6 text-center shadow-[var(--shadow)]">
        <TwinOrb size="md" className="mx-auto" />
        <p className="mt-4">Answer a few training cards first so your twin has something to go on.</p>
        <Link href="/train" className={cn(buttonVariants(), "mt-4")}>
          Start training
        </Link>
      </section>
    );
  }

  const shownBoard = s.phase === "revealed" ? s.result.board : s.board;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 min-[920px]:grid-cols-[1fr_15rem]">
      <section className="space-y-5 rounded-[var(--r-lg)] border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between">
          <Chip>{s.scenario.category}</Chip>
          <TwinOrb size="sm" decorative />
        </div>
        <h2 className="font-display text-[clamp(22px,6vw,28px)] font-[650] leading-tight">{s.scenario.scenario}</h2>

        {s.phase !== "revealed" ? (
          <>
            <div role="group" aria-label="Your secret choice" className="grid gap-2">
              {s.scenario.options.map((o) => {
                const picked = s.choice === o;
                return (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={picked}
                    disabled={s.phase === "locked"}
                    onClick={() => dispatch({ type: "pick", choice: o })}
                    className={cn(
                      "flex min-h-12 items-center justify-between gap-3 rounded-[var(--r-md)] border px-4 py-2 text-left text-[15px] font-medium transition-[border-color,background-color,color] duration-150",
                      picked ? "border-ink bg-ink text-paper" : "border-line hover:border-ink hover:bg-surface-2",
                    )}
                  >
                    {o}
                    {picked && s.phase === "locked" && (
                      <m.span initial={{ scale: 1.6, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: -6 }} transition={springs.bouncy} className="flex items-center gap-1 rounded-md border border-paper/60 px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
                        <Lock className="size-3" aria-hidden /> Locked
                      </m.span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted">Pick what you&apos;d really do. Your twin can&apos;t see it.</p>

            {s.phase === "choosing" ? (
              <>
                <Button size="lg" className="w-full" disabled={!s.choice} onClick={lock}>
                  Lock in &amp; reveal
                </Button>
                {s.error && (
                  <p className="text-sm text-danger" role="alert">
                    {s.error}
                  </p>
                )}
              </>
            ) : (
              <Button size="lg" variant="secondary" className="w-full" onClick={() => dispatch({ type: "skip" })}>
                {/* the accessible name keeps the visible text (WCAG 2.5.3) and says what a press does */}
                <span className="sr-only">Skip countdown:</span>
                {isThinking(s) ? (
                  <span className="flex items-center gap-2">
                    Your twin is thinking <Dots />
                  </span>
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    <m.span key={s.count} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} className="tabular-nums">
                      {s.count} · tap to skip
                    </m.span>
                  </AnimatePresence>
                )}
              </Button>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {[
              { who: "You", icon: Check, choice: s.choice, tone: "you" as const, hit: null },
              { who: "Your twin", icon: UserRound, choice: s.result.round.twinChoice, tone: "twin" as const, hit: s.result.round.twinMatched },
              { who: "A stranger", icon: Users, choice: s.result.round.baselineChoice, tone: "stranger" as const, hit: s.result.round.baselineMatched },
            ].map((row, i) => (
              <m.div
                key={row.who}
                initial={i === 0 ? false : { y: -(i * 76), scale: 0.96, opacity: 0.6 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={{ ...springs.gentle, delay: i * 0.16 }}
                style={{ zIndex: 3 - i }}
                className={cn(
                  "relative flex items-center justify-between gap-3 rounded-[var(--r-md)] px-4 py-3",
                  row.tone === "you" && "bg-ink text-paper",
                  row.tone === "twin" && "bg-twin-soft text-foreground",
                  row.tone === "stranger" && "bg-stranger-soft text-foreground",
                )}
              >
                <span className="min-w-0">
                  <span className={cn("flex items-center gap-1.5 text-xs font-semibold", row.tone === "twin" && "text-twin", row.tone === "stranger" && "text-stranger")}>
                    <row.icon className="size-3.5" aria-hidden /> {row.who}
                  </span>
                  <span className="block break-words text-[15px] font-semibold">{row.choice}</span>
                </span>
                {row.hit !== null && (
                  <Chip tone={row.hit ? "ok" : "bad"}>
                    {row.hit ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
                    {row.hit ? "Matched you" : "Missed"}
                  </Chip>
                )}
              </m.div>
            ))}

            <div ref={verdictRef} aria-live="polite" className="space-y-3 pt-2">
              <p className="font-display text-lg font-bold">
                {s.result.round.twinMatched && !s.result.round.baselineMatched && "Your twin knew you. A stranger didn't."}
                {s.result.round.twinMatched && s.result.round.baselineMatched && "Both got it — this one was a generic answer."}
                {!s.result.round.twinMatched && s.result.round.baselineMatched && "The stranger won this one."}
                {!s.result.round.twinMatched && !s.result.round.baselineMatched && "You surprised everyone."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => dispatch({ type: "next" })}>Next round</Button>
                {!s.result.round.twinMatched && (
                  <Button variant="secondary" onClick={teach} disabled={taught}>
                    {taught ? "Learned" : "Teach this habit"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <ScoreStrip board={shownBoard} />
    </div>
  );
}

/** Three odometers: rounds, twin, stranger (plan §4 ScoreStrip) + lift in words. */
export function ScoreStrip({ board }: { board: DuelScoreboard }) {
  return (
    <aside aria-label="Score" className="self-start rounded-[var(--r-lg)] border border-line bg-surface p-5 shadow-[var(--shadow)]">
      <dl className="grid grid-cols-3 gap-2 text-center min-[920px]:grid-cols-1 min-[920px]:text-left">
        {[
          { label: "Rounds", value: board.rounds, cls: "" },
          { label: "Twin", value: board.twinHits, cls: "text-twin" },
          { label: "Stranger", value: board.baselineHits, cls: "text-stranger" },
        ].map((x) => (
          <div key={x.label}>
            <dt className="text-xs text-muted">{x.label}</dt>
            <dd className={cn("font-display text-3xl font-bold", x.cls)}>
              <Odometer value={x.value} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-muted">
        {board.rounds === 0
          ? "Lift appears after your first round."
          : `Personalization lift: ${board.liftPts > 0 ? "+" : ""}${board.liftPts} points over a stranger.`}
      </p>
    </aside>
  );
}
