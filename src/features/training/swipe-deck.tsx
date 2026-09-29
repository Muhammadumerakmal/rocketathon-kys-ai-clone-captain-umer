"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { MotionMax } from "@/components/providers/motion-max";
import { orb } from "@/components/twin-orb/orb-store";
import { TwinOrb } from "@/components/twin-orb/twin-orb";
import { buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { toast } from "@/components/ui/toaster";
import { postJson } from "@/lib/fetcher";
import type { TrainingProgress } from "@/lib/training/progress";
import { habitFor } from "@/lib/training/labels";
import { pct } from "@/lib/utils";
import { DecisionCard, type DecisionCardHandle } from "./decision-card";

type Card = TrainingProgress["queue"][number];

/**
 * Train screen deck (UI/UX plan §6.2). Optimistic: the deck advances immediately and the
 * answer saves in a transition; on failure the card comes back and a toast explains.
 * Swipe, tap an option, press 1–5, or use ←/→ — all go through one commit function.
 */
export function SwipeDeck({ initial }: { initial: TrainingProgress }) {
  const [progress, setProgress] = useState(initial);
  const [queue, setQueue] = useState<Card[]>(initial.queue);
  const [habits, setHabits] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  const committing = useRef(new Set<string>()); // no double-commit on fast taps
  const top = useRef<DecisionCardHandle>(null);
  const current = queue[0];
  const done = progress.answered + progress.retestsDone;
  const total = progress.total + progress.retestsTotal;

  const commit = useCallback(
    (card: Card, optionId: string) => {
      const key = `${card.question.id}:${card.attempt}`;
      if (committing.current.has(key)) return;
      committing.current.add(key);

      setQueue((q) => q.filter((c) => c !== card)); // optimistic advance
      const habit = card.attempt === 1 ? habitFor(card.question.options.find((o) => o.id === optionId)?.weights ?? {}) : null;
      if (habit) setHabits((h) => (h.includes(habit) ? h : [habit, ...h].slice(0, 8)));

      startTransition(async () => {
        try {
          const next = await postJson<TrainingProgress>("/api/training", { questionId: card.question.id, optionId, attempt: card.attempt });
          setProgress(next);
          orb.setReadiness(next.readiness.known / next.readiness.total);
        } catch {
          setQueue((q) => [card, ...q]); // put it back on top
          if (habit) setHabits((h) => h.filter((x) => x !== habit));
          toast.error("Couldn't save that answer. Try again.");
        } finally {
          committing.current.delete(key);
        }
      });
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl/⌘+1 switches browser tabs, and the tab bar handles its own arrows (it calls
      // preventDefault) — neither should answer a card.
      if (!current || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable],nav,dialog")) return;
      if (e.key === "ArrowLeft") top.current?.chooseDirection(-1);
      else if (e.key === "ArrowRight") top.current?.chooseDirection(1);
      else {
        const option = current.question.options[Number(e.key) - 1];
        if (option) top.current?.chooseOption(option.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      {/* ReadinessHeader */}
      <div className="flex items-center gap-4">
        <TwinOrb size="md" />
        <div aria-live="polite">
          <Chip tone="twin">
            {progress.readiness.known}/{progress.readiness.total}
          </Chip>
          <p className="mt-1 text-sm text-muted">
            Your twin now knows {progress.readiness.known} of {progress.readiness.total} decision dimensions.
          </p>
          <p className="sr-only">
            {done} of {total} cards answered.
          </p>
        </div>
      </div>

      {current ? (
        <MotionMax>
          <div className="relative h-[26rem]">
            {queue
              .slice(0, 3)
              .reverse()
              .map((card, iFromBack, arr) => {
                const depth = arr.length - 1 - iFromBack; // 0 = top
                const key = `${card.question.id}:${card.attempt}`;
                return depth === 0 ? (
                  <DecisionCard
                    key={key}
                    ref={top}
                    question={card.question}
                    retest={card.attempt === 2}
                    onCommit={(optionId) => commit(card, optionId)}
                  />
                ) : (
                  <m.div
                    key={key}
                    aria-hidden
                    className="absolute inset-0 rounded-[var(--r-lg)] border border-line bg-surface shadow-[var(--shadow)]"
                    initial={false}
                    animate={{ scale: 1 - depth * 0.05, y: depth * 12 }}
                  />
                );
              })}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <button type="button" onClick={() => top.current?.chooseDirection(-1)} className="flex min-h-11 items-center gap-1 rounded-full px-3 hover:bg-surface-2">
              <ArrowLeft className="size-4" aria-hidden /> {current.question.options[0]!.label}
            </button>
            <span className="tabular-nums">
              {done + 1}/{total}
            </span>
            <button type="button" onClick={() => top.current?.chooseDirection(1)} className="flex min-h-11 items-center gap-1 rounded-full px-3 hover:bg-surface-2">
              {current.question.options.at(-1)!.label} <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        </MotionMax>
      ) : (
        <section className="rounded-[var(--r-lg)] border border-line bg-surface p-6 shadow-[var(--shadow)]" aria-live="polite">
          <h2 className="font-display text-2xl font-bold">Training complete</h2>
          <p className="mt-2 text-sm text-muted">
            {progress.ceiling !== null
              ? `You gave the same answer ${pct(progress.ceiling)} of the time when asked twice — that's your own consistency, the bar your twin is measured against.`
              : "Your Decision DNA is set."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/duel" className={buttonVariants()}>
              Play Predict me
            </Link>
            <Link href="/memories" className={buttonVariants({ variant: "secondary" })}>
              Add memories
            </Link>
          </div>
        </section>
      )}

      {habits.length > 0 && (
        <div aria-label="Habits your twin learned" className="flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {habits.map((h) => (
              <Chip key={h} tone="twin" popIn>
                {h}
              </Chip>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
