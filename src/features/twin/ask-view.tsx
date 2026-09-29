"use client";

import { History, SquarePen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AiDisclosure } from "@/components/shared/ai-disclosure";
import { Composer, looksLikeChoice, type ComposerTools } from "./composer";
import { HistorySheet } from "./history-sheet";
import { StartScreen } from "./start-screen";
import { TwinMessage, UserBubble } from "./thread-message";
import { useAsk } from "./use-ask";

const NEAR_BOTTOM_PX = 120;

/**
 * Ask (UI/UX plan §6.4) in a ChatKit-style layout: header with history + new chat,
 * start screen, thread (bubbles + widgets), sticky composer with tool chips.
 */
export function AskView() {
  const ask = useAsk();
  const [input, setInput] = useState("");
  const [tools, setTools] = useState<ComposerTools>({ predict: false, asOf: "" });
  const [historyOpen, setHistoryOpen] = useState(false);
  const lastUser = useRef<{ text: string; predict: boolean } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  // Auto-scroll only if the reader is already near the bottom (plan §6.4).
  useEffect(() => {
    const onScroll = () => {
      nearBottom.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - NEAR_BOTTOM_PX;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (nearBottom.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [ask.turns]);

  function submit(text = input, predict = tools.predict || looksLikeChoice(text)) {
    const msg = text.trim();
    if (!msg || ask.busy) return;
    lastUser.current = { text: msg, predict };
    setInput("");
    nearBottom.current = true;
    void ask.send(msg, { predict, asOf: tools.asOf ? new Date(`${tools.asOf}T12:00:00Z`).toISOString() : null });
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-2 pb-2">
        <div>
          <h1 className="font-display text-[clamp(26px,7vw,36px)] font-bold leading-tight">Ask your twin</h1>
          <p className="text-sm text-muted">An AI model of your stated patterns — not you.</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setHistoryOpen(true)} aria-label="Conversation history" className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground">
            <History className="size-5" strokeWidth={1.8} />
          </button>
          <button type="button" onClick={ask.reset} disabled={ask.turns.length === 0} aria-label="New conversation" className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30">
            <SquarePen className="size-5" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-6 pb-6">
        {ask.turns.length === 0 ? (
          <StartScreen onPick={(s) => submit(s.prompt, s.predict)} />
        ) : (
          ask.turns.map((t, i) =>
            t.role === "user" ? (
              <UserBubble key={t.id} text={t.text} />
            ) : (
              <TwinMessage
                key={t.id}
                turn={t}
                onRetry={() => {
                  const prev = ask.turns[i - 1];
                  if (prev?.role === "user") submit(prev.text, t.kind === "prediction");
                }}
                onRetime={(asOf) => t.kind === "prediction" && t.prediction && ask.retime(t.id, t.scenario, t.prediction.options, asOf)}
                onDismissSuggestion={(content) => ask.dismissSuggestion(t.id, content)}
              />
            ),
          )
        )}
        <div ref={endRef} />
      </div>

      {/* sticky composer, clear of the phone tab bar */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 bg-gradient-to-t from-paper from-70% to-transparent pb-2 pt-4 min-[920px]:bottom-4">
        <Composer value={input} onChange={setInput} onSend={() => submit()} onStop={ask.stop} busy={ask.busy} tools={tools} onTools={setTools} />
        <AiDisclosure className="mt-2 hidden min-[920px]:block" />
      </div>

      <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} onOpenThread={ask.loadThread} />
    </div>
  );
}
