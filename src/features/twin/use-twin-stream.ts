"use client";

import { useCallback, useRef, useState } from "react";
import type { EvidenceRef } from "@/contracts";
import { createSseParser } from "./sse";

export interface ChatMessage {
  id: string;
  role: "user" | "twin";
  text: string;
  evidence?: EvidenceRef[];
  error?: string;
  asOf?: string | null;
}

/** Streams /api/twin: text deltas, evidence, errors. No UI-SDK dependency (plan §11.1). */
export function useTwinStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const chatId = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const patchLast = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((prev) => (prev.length ? [...prev.slice(0, -1), fn(prev[prev.length - 1]!)] : prev));

  const send = useCallback(async (text: string, asOf: string | null) => {
    const controller = new AbortController();
    abort.current = controller;
    setStreaming(true);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text, asOf },
      { id: crypto.randomUUID(), role: "twin", text: "", asOf },
    ]);

    try {
      const res = await fetch("/api/twin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatId.current, message: text, asOf }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      const parse = createSseParser();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const e of parse(value)) {
          if (e.type === "meta") chatId.current = e.chatId;
          else if (e.type === "text") patchLast((m) => ({ ...m, text: m.text + e.delta }));
          else if (e.type === "evidence") patchLast((m) => ({ ...m, evidence: e.evidence }));
          else if (e.type === "error") patchLast((m) => ({ ...m, error: e.message }));
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        patchLast((m) => ({ ...m, error: err instanceof Error ? err.message : "Connection lost." }));
      }
    } finally {
      setStreaming(false);
      abort.current = null;
    }
  }, []);

  const stop = useCallback(() => abort.current?.abort(), []);
  const reset = useCallback(() => {
    chatId.current = null;
    setMessages([]);
  }, []);

  return { messages, streaming, send, stop, reset };
}
