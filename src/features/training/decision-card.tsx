"use client";

import { animate, m, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { TrainingQuestion } from "@/contracts";
import { springs } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { commitDirection, optionForDirection, RUBBER_BAND_AT } from "./deck-physics";

export interface DecisionCardHandle {
  /** keyboard / arrow buttons: same throw animation as a swipe */
  chooseDirection: (dir: -1 | 1) => void;
  chooseOption: (optionId: string) => void;
}

interface Props {
  question: TrainingQuestion;
  retest: boolean;
  /** called AFTER the throw animation, so the card is never unmounted mid-flight */
  onCommit: (optionId: string) => void;
}

/**
 * The draggable top card (UI/UX plan §6.2): follows the finger, rotates x/18°, rubber-bands
 * past 150px, shows which answer you're leaning to, then throws off with release velocity
 * (fling spring) or springs back (bouncy). Every input path funnels into `choose`.
 */
export const DecisionCard = forwardRef<DecisionCardHandle, Props>(function DecisionCard({ question, retest, onCommit }, ref) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const opacity = useMotionValue(1);
  const rotate = useTransform(x, (v) => v / 18);
  const leftHint = useTransform(x, [-110, -30, 0], [1, 0.2, 0]);
  const rightHint = useTransform(x, [0, 30, 110], [0, 0.2, 1]);
  const chosen = useRef(false); // one choice per card, however fast the taps

  const left = optionForDirection(question.options, -1);
  const right = optionForDirection(question.options, 1);

  async function choose(optionId: string, dir: -1 | 1, velocity = 0) {
    if (chosen.current) return;
    chosen.current = true;
    const width = typeof window === "undefined" ? 800 : window.innerWidth;
    if (!reduced) setTimeout(() => animate(opacity, 0, { duration: 0.14 }), 140);
    await animate(x, dir * width * 1.4, reduced ? { duration: 0 } : { ...springs.fling, velocity });
    onCommit(optionId);
  }

  /** a tapped option flies toward its own side of the card */
  const dirForOption = (optionId: string): -1 | 1 => (question.options.findIndex((o) => o.id === optionId) === 0 ? -1 : 1);

  useImperativeHandle(ref, () => ({
    chooseDirection: (dir) => void choose(optionForDirection(question.options, dir).id, dir),
    chooseOption: (optionId) => void choose(optionId, dirForOption(optionId)),
  }));

  function onDragEnd(_: unknown, info: PanInfo) {
    const dir = commitDirection(info.offset.x, info.velocity.x);
    if (dir === 0) {
      animate(x, 0, springs.bouncy);
      return;
    }
    void choose(optionForDirection(question.options, dir).id, dir, info.velocity.x);
  }

  return (
    <m.article
      className="absolute inset-0 flex cursor-grab touch-pan-y select-none flex-col rounded-[var(--r-lg)] border border-line bg-surface p-6 shadow-[var(--shadow)] active:cursor-grabbing"
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: -RUBBER_BAND_AT, right: RUBBER_BAND_AT }}
      dragElastic={0.55}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      aria-roledescription="decision card"
      aria-label={question.question}
    >
      {retest && <p className="mb-2 text-[13px] font-semibold text-twin">Consistency check: answer honestly, not from memory</p>}
      <h2 className="font-display text-[clamp(22px,6vw,28px)] font-[650] leading-tight">{question.question}</h2>

      <div className="mt-auto grid gap-2 pt-6">
        {question.options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            onPointerDown={(e) => e.stopPropagation()} // taps shouldn't start a drag
            onClick={() => void choose(o.id, dirForOption(o.id))}
            className="flex min-h-12 items-center gap-3 rounded-[var(--r-md)] border border-line px-4 py-2 text-left text-[15px] font-medium transition-[border-color,background-color] duration-150 hover:border-ink hover:bg-surface-2"
          >
            <kbd className="grid size-6 place-items-center rounded-md border border-line text-xs text-faint">{i + 1}</kbd>
            {o.label}
          </button>
        ))}
      </div>

      {/* swipe hints: which answer a drag means */}
      <m.span style={{ opacity: leftHint }} aria-hidden className={cn(hintCls, "left-4")}>
        ← {left.label}
      </m.span>
      <m.span style={{ opacity: rightHint }} aria-hidden className={cn(hintCls, "right-4")}>
        {right.label} →
      </m.span>
    </m.article>
  );
});

const hintCls = "pointer-events-none absolute top-4 max-w-[45%] rounded-full bg-ink px-3 py-1 text-[13px] font-semibold text-paper";
