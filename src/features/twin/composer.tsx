"use client";

import { ArrowUp, CalendarClock, Sparkles, Square, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { orb } from "@/components/twin-orb/orb-store";
import { cn } from "@/lib/utils";

export interface ComposerTools {
  predict: boolean;
  asOf: string; // yyyy-mm-dd or ""
}

/** "A or B?" questions default to Predict mode (predictions over explicit options are scoreable). */
export const looksLikeChoice = (s: string) => /\bor\b/i.test(s) && /\?\s*$/.test(s.trim());

/**
 * ChatKit-style composer (UI/UX plan §6.4): auto-growing input, Enter sends, Shift+Enter
 * newline, round send / stop button, tool chips (Predict, As of). The orb listens while typing.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  tools,
  onTools,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  tools: ComposerTools;
  onTools: (t: ComposerTools) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // auto-grow up to ~6 lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value]);

  // orb: listening while there's text, thinking while the twin answers
  useEffect(() => {
    orb.setMode(busy ? "thinking" : value.trim() ? "listening" : "idle");
  }, [busy, value]);
  useEffect(() => () => orb.setMode("idle"), []);

  const canSend = value.trim().length > 0 && !busy;

  return (
    <div className="rounded-[var(--r-lg)] border border-line bg-surface p-2 shadow-[var(--shadow)] focus-within:border-ink/40">
      <label htmlFor="ask-input" className="sr-only">
        Ask your twin
      </label>
      <textarea
        id="ask-input"
        ref={ref}
        rows={1}
        value={value}
        maxLength={4000}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) onSend();
          }
        }}
        placeholder={tools.predict ? "Two options — e.g. “Stay in my job or take the offer?”" : "Ask your twin anything about how you decide…"}
        className="block max-h-[168px] w-full resize-none bg-transparent px-3 py-2.5 text-[16px] outline-none placeholder:text-faint"
      />
      <div className="flex items-center gap-1.5 px-1 pb-0.5">
        <button
          type="button"
          aria-pressed={tools.predict}
          onClick={() => onTools({ ...tools, predict: !tools.predict })}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold",
            tools.predict ? "border-twin/40 bg-twin-soft text-twin" : "border-line text-muted hover:text-foreground",
          )}
        >
          <Sparkles className="size-3.5" aria-hidden /> Predict
        </button>
        <label
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold",
            tools.asOf ? "border-ink/40 bg-surface-2 text-foreground" : "border-line text-muted hover:text-foreground",
          )}
        >
          <CalendarClock className="size-3.5" aria-hidden />
          <span className="sr-only">Ask as of a past date</span>
          <input
            type="date"
            value={tools.asOf}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onTools({ ...tools, asOf: e.target.value })}
            className="w-[7.5rem] bg-transparent text-[13px] outline-none [color-scheme:inherit]"
            aria-label="As of date"
          />
          {tools.asOf && (
            <button type="button" onClick={() => onTools({ ...tools, asOf: "" })} aria-label="Clear date" className="-mr-1 rounded-full p-0.5 hover:bg-surface">
              <X className="size-3" aria-hidden />
            </button>
          )}
        </label>
        <div className="ml-auto">
          {busy ? (
            <button type="button" onClick={onStop} aria-label="Stop" className="grid size-10 place-items-center rounded-full bg-ink text-paper">
              <Square className="size-3.5 fill-current" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              aria-label="Send"
              className="grid size-10 place-items-center rounded-full bg-ink text-paper transition-transform active:scale-[0.96] disabled:opacity-30"
            >
              <ArrowUp className="size-5" strokeWidth={2.2} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
