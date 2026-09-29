"use client";

import { BookOpen, Copy, RotateCcw } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import { TwinOrb } from "@/components/twin-orb/twin-orb";
import { Chip } from "@/components/ui/chip";
import { toast } from "@/components/ui/toaster";
import { PredictionCard } from "@/features/predictions/prediction-card";
import type { MemoryUpdate } from "@/contracts";
import { ApprovalCard } from "./approval-card";
import { MarkdownMessage } from "./markdown-message";
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
}: {
  turn: TwinTurn;
  onRetry: () => void;
  onRetime: (asOf: string | null) => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const [rating, setRating] = useState<"mostly" | "wrong" | null>(null);
  const [correction, setCorrection] = useState("");
  const [feedbackState, setFeedbackState] = useState<"idle" | "sending" | "saved">("idle");
  const [feedbackUpdate, setFeedbackUpdate] = useState<MemoryUpdate | null>(null);

  async function submitFeedback(value: "exactly" | "mostly" | "wrong") {
    if (turn.kind !== "chat" || feedbackState !== "idle") return;
    setFeedbackState("sending");
    try {
      const res = await fetch("/api/twin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: turn.chatId ?? null,
          answerExcerpt: turn.text.slice(0, 1000),
          rating: value,
          correction: correction.trim() || undefined,
          memoryIds: turn.usedMemories?.map((memory) => memory.id) ?? [],
        }),
      });
      if (!res.ok) throw new Error("Could not save feedback. Try again.");
      const body = (await res.json()) as { update: MemoryUpdate };
      setFeedbackUpdate(body.update);
      setFeedbackState("saved");
    } catch (error) {
      setFeedbackState("idle");
      toast.error(error instanceof Error ? error.message : "Could not save feedback.");
    }
  }

  return (
    <div className="flex gap-3">
      <TwinOrb size="sm" decorative className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-3">
        {turn.asOf && <Chip tone="twin">Answering as you were on {turn.asOf.slice(0, 10)}</Chip>}
        <ProgressSteps status={turn.status} mode={turn.kind} />

        {turn.kind === "chat" && turn.text && (
          <div className="space-y-2">
            <MarkdownMessage text={turn.text} />
            {!turn.streaming && (
              <div className="flex items-center gap-1 text-muted">
                <ActionButton label="Copy" onClick={() => navigator.clipboard.writeText(turn.text).then(() => toast.info("Copied"))}>
                  <Copy className="size-4" aria-hidden />
                </ActionButton>
                <ActionButton label="Ask again" onClick={onRetry}>
                  <RotateCcw className="size-4" aria-hidden />
                </ActionButton>
                {turn.usedMemories && turn.usedMemories.length > 0 && (
                  <button type="button" onClick={() => setShowWhy((v) => !v)} aria-expanded={showWhy} className="flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold hover:bg-surface-2 hover:text-foreground">
                    <BookOpen className="size-4" aria-hidden /> Based on {turn.usedMemories.length} {turn.usedMemories.length === 1 ? "memory" : "memories"}
                  </button>
                )}
              </div>
            )}
            {showWhy && turn.usedMemories && (
              <ul className="flex flex-wrap gap-1.5">
                {turn.usedMemories.map((e) => (
                  <li key={e.id} className="rounded-full border border-line px-2.5 py-1 text-[13px]">
                    {e.label}
                  </li>
                ))}
              </ul>
            )}
            {!turn.streaming && !turn.error && turn.usedMemories && turn.usedMemories.length > 0 && (
              <div className="space-y-2 text-sm">
                {feedbackState === "saved" ? (
                  <p className="text-muted" role="status">
                    Feedback saved.
                    {feedbackUpdate && feedbackUpdate.saved.length > 0 && ` Remembered: ${feedbackUpdate.saved.join("; ")}.`}
                    {feedbackUpdate && feedbackUpdate.replaced.length > 0 && ` Updated: ${feedbackUpdate.replaced.map((item) => item.to).join("; ")}.`}
                  </p>
                ) : (
                  <>
                    <p className="text-muted">How well did your twin understand you?</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={feedbackState === "sending"} onClick={() => void submitFeedback("exactly")} className="min-h-9 rounded-full border border-line px-3 hover:bg-surface-2">Exactly</button>
                      <button type="button" disabled={feedbackState === "sending"} onClick={() => setRating("mostly")} className="min-h-9 rounded-full border border-line px-3 hover:bg-surface-2">Mostly right</button>
                      <button type="button" disabled={feedbackState === "sending"} onClick={() => setRating("wrong")} className="min-h-9 rounded-full border border-line px-3 hover:bg-surface-2">Wrong</button>
                    </div>
                    {rating && (
                      <div className="space-y-2">
                        <label htmlFor={`correction-${turn.id}`} className="block text-muted">What should your twin remember? (optional)</label>
                        <textarea id={`correction-${turn.id}`} value={correction} onChange={(event) => setCorrection(event.target.value)} maxLength={1000} rows={2} className="w-full rounded-[var(--r-md)] border border-line bg-surface p-2" />
                        <button type="button" disabled={feedbackState === "sending"} onClick={() => void submitFeedback(rating)} className="min-h-9 rounded-full bg-ink px-4 text-paper disabled:opacity-50">Save feedback</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {!turn.streaming && turn.memoryUpdate && (
              <p className="text-sm text-muted" role="status">
                {turn.memoryUpdate.saved.length > 0 && `Remembered: ${turn.memoryUpdate.saved.join("; ")}. `}
                {turn.memoryUpdate.replaced.length > 0 && `Updated: ${turn.memoryUpdate.replaced.map((item) => item.to).join("; ")}. `}
                {turn.memoryUpdate.forgotten.length > 0 && `Forgotten: ${turn.memoryUpdate.forgotten.join("; ")}. `}
                {turn.memoryUpdate.reinforced.length > 0 && `Confirmed: ${turn.memoryUpdate.reinforced.join("; ")}.`}
              </p>
            )}
            {turn.memoryError && <p className="text-sm text-danger" role="alert">{turn.memoryError}</p>}
          </div>
        )}

        {turn.kind === "prediction" && turn.prediction && (
          <PredictionCard prediction={turn.prediction} onRetime={onRetime} retiming={turn.streaming} />
        )}

        {turn.kind === "chat" && turn.approval && <ApprovalCard approval={turn.approval} />}

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
