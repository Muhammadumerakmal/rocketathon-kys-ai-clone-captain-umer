"use client";

import { History } from "lucide-react";
import { m } from "motion/react";
import { springs } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

/** Six months back: long enough for beliefs to have changed, short enough to feel like "you". */
export function pastDate(now = new Date()): string {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - 6);
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString();
}

/**
 * Now / past segmented control with a sliding thumb (UI/UX plan §4, §6.4 "Time travel").
 * Arrow keys switch; the parent morphs the existing card rather than mounting a new one.
 */
export function TimeTravelToggle({ asOf, onChange, disabled }: { asOf: string | null; onChange: (asOf: string | null) => void; disabled?: boolean }) {
  const past = asOf !== null;
  const options = [
    { label: "Now", value: null, active: !past },
    { label: "6 months ago", value: pastDate(), active: past },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Answer as you are now, or as you were"
      className="relative flex rounded-full bg-surface-2 p-1 text-[13px] font-semibold"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          if (!disabled) onChange(past ? null : pastDate());
        }
      }}
    >
      <m.span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-surface shadow-sm"
        initial={false}
        animate={{ x: past ? "100%" : "0%" }}
        transition={springs.snappy}
      />
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={o.active}
          tabIndex={o.active ? 0 : -1}
          disabled={disabled}
          onClick={() => !o.active && onChange(o.value)}
          className={cn("relative z-10 flex min-h-9 flex-1 items-center justify-center gap-1 whitespace-nowrap px-3", o.active ? "text-foreground" : "text-muted")}
        >
          {o.value && <History className="size-3.5" aria-hidden />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
