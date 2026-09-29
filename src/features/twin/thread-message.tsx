"use client";

import { BookOpen, Copy, RotateCcw } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import { TwinOrb } from "@/components/twin-orb/twin-orb";
import { Chip } from "@/components/ui/chip";
import { toast } from "@/components/ui/toaster";
import { PredictionCard } from "@/features/predictions/prediction-card";
import { ApprovalCard } from "./approval-card";
import { MemorySuggestionCard } from "./memory-suggestion-card";
import { ProgressSteps } from "./progress-steps";
import type { Turn, TwinTurn } from "./use-ask";

/** Your message: right-aligned bubble (ChatKit style). */
export function UserBubble({ text }: { text: string }) {
  return (
    <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-ink px-4 py-2.5 text-[15px] text-paper">{text}</p>
    </m.div>
  );
}

/** The twin's turn: full-width text or a prediction widget, plus inline widgets and actions. */
export function TwinMessage({
  turn,
  onRetry,
  onRetime,
  onDismissSuggestion,
}: {
  turn: TwinTurn;
  onRetry: () => void;
  onRetime: (asOf: string | null) => void;
  onDismissSuggestion: (content: string) => void;
}) {
  const [showWhy, setShowWhy] = useState(false);

  return (
    <div className="flex gap-3">
      <TwinOrb size="sm" decorative className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-3">
        {turn.asOf && <Chip tone="twin">Answering as you were on {turn.asOf.slice(0, 10)}</Chip>}
        <ProgressSteps status={turn.status} mode={turn.kind} />

        {turn.kind === "chat" && turn.text && (
          <div className="space-y-2">
            {/* model output rendered as plain text, never HTML (Ultra plan §10) */}
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{turn.text}</p>
            {!turn.streaming && (
              <div className="flex items-center gap-1 text-muted">
                <ActionButton label="Copy" onClick={() => navigator.clipboard.writeText(turn.text).then(() => toast.info("Copied"))}>
                  <Copy className="size-4" aria-hidden />
                </ActionButton>
                <ActionButton label="Ask again" onClick={onRetry}>
                  <RotateCcw className="size-4" aria-hidden />
                </ActionButton>
                {turn.evidence && turn.evidence.length > 0 && (
                  <button type="button" onClick={() => setShowWhy((v) => !v)} aria-expanded={showWhy} className="flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold hover:bg-surface-2 hover:text-foreground">
                    <BookOpen className="size-4" aria-hidden /> Based on {turn.evidence.length} {turn.evidence.length === 1 ? "memory" : "memories"}
                  </button>
                )}
              </div>
            )}
            {showWhy && turn.evidence && (
              <ul className="flex flex-wrap gap-1.5">
                {turn.evidence.map((e) => (
                  <li key={e.id} className="rounded-full border border-line px-2.5 py-1 text-[13px]">
                    {e.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {turn.kind === "prediction" && turn.prediction && (
          <PredictionCard prediction={turn.prediction} onRetime={onRetime} retiming={turn.streaming} />
        )}

        {turn.kind === "chat" && turn.approval && <ApprovalCard approval={turn.approval} />}
        {turn.kind === "chat" &&
          turn.suggestions?.map((s) => <MemorySuggestionCard key={s.content} suggestion={s} onDismiss={() => onDismissSuggestion(s.content)} />)}

        {turn.error && (
          <div className="flex flex-wrap items-center gap-2 rounded-[var(--r-md)] bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            {turn.error}
            <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="grid size-9 place-items-center rounded-full hover:bg-surface-2 hover:text-foreground">
      {children}
    </button>
  );
}

export type { Turn };
