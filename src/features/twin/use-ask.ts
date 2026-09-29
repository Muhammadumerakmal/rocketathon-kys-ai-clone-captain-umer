"use client";

import { useCallback, useRef, useState } from "react";
import type { EvidenceRef, MemorySuggestion, Prediction, PredictStreamEvent, StatusStep, TwinStreamEvent } from "@/contracts";
import { createSseParser } from "./sse";

/**
 * Ask screen state (UI/UX plan §6.4, ChatKit-style thread). One hook drives both streams:
 * chat (/api/twin) and prediction (/api/predict/stream). Progress comes from real events.
 */
export type Status = { step: StatusStep; done?: number; total?: number } | null;

export type Turn =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "twin";
      kind: "chat";
      text: string;
      status: Status;
      streaming: boolean;
      evidence?: EvidenceRef[];
      approval?: { proposalId: string; token: string; summary: string };
      suggestions?: MemorySuggestion[];
      error?: string;
      asOf: string | null;
    }
  | {
      id: string;
      role: "twin";
      kind: "prediction";
      scenario: string;
      status: Status;
      streaming: boolean;
      prediction?: Prediction;
      error?: string;
      asOf: string | null;
    };

export type TwinTurn = Extract<Turn, { role: "twin" }>;

async function readSse<E>(res: Response, onEvent: (e: E) => void) {
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? "Your twin couldn't answer right now. Nothing was saved. Try again.");
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const parse = createSseParser();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const e of parse(value)) onEvent(e as E);
  }
}

export function useAsk() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const patch = (id: string, fn: (t: TwinTurn) => TwinTurn) =>
    setTurns((ts) => ts.map((t) => (t.id === id && t.role === "twin" ? fn(t) : t)));

  const send = useCallback(
    async (text: string, opts: { predict: boolean; asOf: string | null }) => {
      const controller = new AbortController();
      abort.current = controller;
      setBusy(true);
      const replyId = crypto.randomUUID();
      const reply: TwinTurn = opts.predict
        ? { id: replyId, role: "twin", kind: "prediction", scenario: text, status: null, streaming: true, asOf: opts.asOf }
        : { id: replyId, role: "twin", kind: "chat", text: "", status: null, streaming: true, asOf: opts.asOf };
      setTurns((ts) => [...ts, { id: crypto.randomUUID(), role: "user", text }, reply]);

      try {
        if (opts.predict) {
          const res = await fetch("/api/predict/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario: text, asOf: opts.asOf }),
            signal: controller.signal,
          });
          await readSse<PredictStreamEvent>(res, (e) => {
            if (e.type === "status") patch(replyId, (t) => ({ ...t, status: { step: e.step, done: e.done, total: e.total } }));
            else if (e.type === "prediction") patch(replyId, (t) => ({ ...t, prediction: e.prediction, status: null }) as TwinTurn);
            else if (e.type === "error") patch(replyId, (t) => ({ ...t, error: e.message, status: null }));
          });
        } else {
          const res = await fetch("/api/twin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId: threadId, message: text, asOf: opts.asOf }),
            signal: controller.signal,
          });
          await readSse<TwinStreamEvent>(res, (e) => {
            switch (e.type) {
              case "meta":
                setThreadId(e.chatId);
                break;
              case "status":
                patch(replyId, (t) => ({ ...t, status: { step: e.step, done: e.done, total: e.total } }));
                break;
              case "evidence":
                patch(replyId, (t) => ({ ...t, evidence: e.evidence }) as TwinTurn);
                break;
              case "text":
                patch(replyId, (t) => (t.kind === "chat" ? { ...t, status: null, text: t.text + e.delta } : t));
                break;
              case "approval_required":
                patch(replyId, (t) => ({ ...t, approval: { proposalId: e.proposalId, token: e.token, summary: e.summary } }) as TwinTurn);
                break;
              case "memory_suggestion":
                patch(replyId, (t) => ({ ...t, suggestions: e.suggestions }) as TwinTurn);
                break;
              case "error":
                patch(replyId, (t) => ({ ...t, error: e.message, status: null }));
                break;
            }
          });
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          patch(replyId, (t) => ({ ...t, error: err instanceof Error ? err.message : "Connection lost.", status: null }));
        }
      } finally {
        patch(replyId, (t) => ({ ...t, streaming: false, status: null }));
        setBusy(false);
        abort.current = null;
      }
    },
    [threadId],
  );

  /** Time-travel: re-ask the same scenario as of a date, morphing the existing card. */
  const retime = useCallback(async (turnId: string, scenario: string, options: string[], asOf: string | null) => {
    patch(turnId, (t) => ({ ...t, streaming: true, asOf }));
    try {
      const res = await fetch("/api/predict/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, options, asOf }),
      });
      await readSse<PredictStreamEvent>(res, (e) => {
        if (e.type === "prediction") patch(turnId, (t) => ({ ...t, prediction: e.prediction }) as TwinTurn);
        else if (e.type === "error") patch(turnId, (t) => ({ ...t, error: e.message }));
      });
    } finally {
      patch(turnId, (t) => ({ ...t, streaming: false }));
    }
  }, []);

  const dismissSuggestion = useCallback((turnId: string, content: string) => {
    patch(turnId, (t) => (t.kind === "chat" ? { ...t, suggestions: t.suggestions?.filter((s) => s.content !== content) } : t));
  }, []);

  const loadThread = useCallback((id: string, messages: { role: "user" | "twin"; text: string }[]) => {
    setThreadId(id);
    setTurns(
      messages.map((m) =>
        m.role === "user"
          ? { id: crypto.randomUUID(), role: "user", text: m.text }
          : { id: crypto.randomUUID(), role: "twin", kind: "chat", text: m.text, status: null, streaming: false, asOf: null },
      ),
    );
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    setThreadId(null);
    setTurns([]);
  }, []);

  const stop = useCallback(() => abort.current?.abort(), []);

  return { turns, threadId, busy, send, retime, stop, reset, loadThread, dismissSuggestion };
}
