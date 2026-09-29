"use client";

import { History, Send, Square } from "lucide-react";
import { useState, type FormEvent } from "react";
import { EvidenceList } from "@/components/shared/evidence-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTwinStream } from "./use-twin-stream";

const SUGGESTIONS = [
  "Should I take the paid safe job or the unpaid dream internship?",
  "What do I usually do when a deadline is close?",
  "What matters most to me right now?",
];

export function TwinChat({ twinName }: { twinName: string }) {
  const { messages, streaming, send, stop, reset } = useTwinStream();
  const [input, setInput] = useState("");
  const [asOf, setAsOf] = useState("");

  function submit(e?: FormEvent, text = input) {
    e?.preventDefault();
    const msg = text.trim();
    if (!msg || streaming) return;
    setInput("");
    send(msg, asOf ? new Date(`${asOf}T12:00:00Z`).toISOString() : null);
  }

  return (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[28rem] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-muted">
          <History className="size-4" aria-hidden />
          Ask as of
          <input
            type="date"
            value={asOf}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setAsOf(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1"
          />
        </label>
        {asOf && (
          <Badge tone="twin">
            Time-travel: {new Date(asOf).toLocaleDateString(undefined, { month: "long", year: "numeric" })}-you
          </Badge>
        )}
        {messages.length > 0 && (
          <button type="button" onClick={reset} className="ml-auto text-xs text-muted hover:underline">
            New chat
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-border bg-surface p-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-3 text-sm text-muted">
            <p>Ask {twinName}&apos;s twin anything about how you decide. It answers from what you&apos;ve told it — and shows which memories it used.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => submit(undefined, s)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-twin">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] space-y-2", m.role === "user" && "rounded-lg bg-twin/10 px-3 py-2")}>
                {m.role === "twin" && m.asOf && <Badge tone="twin">as of {m.asOf.slice(0, 10)}</Badge>}
                {/* Plain text rendering: model output is never injected as HTML (plan §10). */}
                <p className="whitespace-pre-wrap text-sm">{m.text || (m.role === "twin" && !m.error ? "…" : "")}</p>
                {m.error && (
                  <p className="text-sm text-danger" role="alert">
                    {m.error}
                  </p>
                )}
                {m.role === "twin" && m.evidence && (
                  <Card className="p-3">
                    <details open={false}>
                      <summary className="cursor-pointer text-xs font-medium">Evidence ({m.evidence.length})</summary>
                      <div className="mt-2">
                        <EvidenceList evidence={m.evidence} />
                      </div>
                    </details>
                  </Card>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="twin-input" className="sr-only">
          Message your twin
        </label>
        <input
          id="twin-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={4000}
          placeholder="Ask your twin…"
          className="h-11 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
        />
        {streaming ? (
          <Button type="button" variant="secondary" onClick={stop} aria-label="Stop">
            <Square className="size-4" />
          </Button>
        ) : (
          <Button type="submit" aria-label="Send" disabled={!input.trim()}>
            <Send className="size-4" />
          </Button>
        )}
      </form>
    </div>
  );
}
