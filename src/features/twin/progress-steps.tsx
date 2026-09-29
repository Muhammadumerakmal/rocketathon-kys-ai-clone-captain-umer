"use client";

import { Check } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import type { StatusStep } from "@/contracts";
import { cn } from "@/lib/utils";
import type { Status } from "./use-ask";

const ORDER: StatusStep[] = ["retrieving", "sampling", "baseline"];

const LABEL: Record<StatusStep, (s: Status) => string> = {
  retrieving: () => "Reading your memories",
  sampling: (s) => `Asking 5 times to check it's consistent${s?.total ? ` · ${s.done ?? 0}/${s.total}` : ""}`,
  baseline: () => "Comparing with a stranger",
};

/**
 * ChatKit-style progress (UI/UX plan §6.4). Reflects REAL server events only: a step is
 * "done" once the server has moved past it — there are no fake timers here.
 */
export function ProgressSteps({ status, mode }: { status: Status; mode: "chat" | "prediction" }) {
  if (!status) return null;
  const steps = mode === "chat" ? (["retrieving"] as StatusStep[]) : ORDER;
  const current = ORDER.indexOf(status.step);

  return (
    <ol className="space-y-1.5 text-sm" aria-live="polite" aria-label="What your twin is doing">
      <AnimatePresence initial={false}>
        {steps
          .filter((s) => ORDER.indexOf(s) <= current)
          .map((s) => {
            const done = ORDER.indexOf(s) < current;
            return (
              <m.li key={s} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
                {done ? (
                  <Check className="size-4 text-success" aria-hidden />
                ) : (
                  <span className="grid size-4 place-items-center" aria-hidden>
                    <span className="size-1.5 animate-pulse rounded-full bg-twin" />
                  </span>
                )}
                <span className={cn(done ? "text-muted" : "animate-pulse font-medium text-foreground")}>{LABEL[s](status)}</span>
                {done && <span className="sr-only">done</span>}
              </m.li>
            );
          })}
      </AnimatePresence>
    </ol>
  );
}
