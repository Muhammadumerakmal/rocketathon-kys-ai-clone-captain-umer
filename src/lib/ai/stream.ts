import "server-only";
import {
  InputGuardrailTripwireTriggered,
  MaxTurnsExceededError,
  ModelTimeoutError,
  OutputGuardrailTripwireTriggered,
  type StreamedRunResult,
} from "@openai/agents";
import { HttpError } from "@/lib/http";
import { detectImpersonation } from "./guardrails";

/** Map errors to a user-safe stream event. Internals never reach the browser. */
export function streamErrorEvent(err: unknown, userMessage = ""): { type: "error"; code: string; message: string } {
  if (err instanceof InputGuardrailTripwireTriggered) {
    return { type: "error", code: "guardrail_blocked", message: detectImpersonation(userMessage) ?? "I can't help with that request." };
  }
  if (err instanceof OutputGuardrailTripwireTriggered) {
    return { type: "error", code: "guardrail_blocked", message: "I stopped that answer because it didn't meet TwinOS's honesty rules. Try rephrasing." };
  }
  if (err instanceof HttpError) return { type: "error", code: err.code, message: err.message };
  if (err instanceof ModelTimeoutError || (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"))) {
    return { type: "error", code: "upstream_timeout", message: "Your twin couldn't answer right now. Nothing was saved. Try again." };
  }
  if (err instanceof MaxTurnsExceededError) {
    return { type: "error", code: "internal", message: "Your twin got stuck. Try a simpler question." };
  }
  console.error("[stream] error", err);
  return { type: "error", code: "internal", message: "Your twin couldn't answer right now. Nothing was saved. Try again." };
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

/**
 * Open an SSE response immediately and let `work` emit events as real steps happen
 * (so "Reading your memories" appears while retrieval is actually running).
 * Any thrown error becomes one safe `error` event; `done` is always sent last on success.
 */
export function sseResponse<E extends { type: string }>(
  work: (send: (e: E) => void) => Promise<void>,
  opts: { userMessage?: string } = {},
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: E) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        await work(send);
        send({ type: "done" } as E);
      } catch (err) {
        send(streamErrorEvent(err, opts.userMessage) as unknown as E);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}

/** Pipe an Agents SDK run's text into `send`, then surface any run error. */
export async function pipeAgentText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: StreamedRunResult<any, any>,
  send: (e: { type: "text"; delta: string }) => void,
): Promise<void> {
  // The SDK's stream shim guarantees async iteration (not getReader) across runtimes.
  for await (const delta of result.toTextStream()) {
    if (delta) send({ type: "text", delta });
  }
  await result.completed;
  if (result.error) throw result.error;
}
