import "server-only";
import {
  InputGuardrailTripwireTriggered,
  MaxTurnsExceededError,
  ModelTimeoutError,
  OutputGuardrailTripwireTriggered,
  type StreamedRunResult,
} from "@openai/agents";
import type { TwinStreamEvent } from "@/contracts";
import { detectImpersonation } from "./guardrails";

/** Map SDK errors to a user-safe stream event. Internals never reach the browser. */
export function streamErrorEvent(err: unknown, userMessage = ""): Extract<TwinStreamEvent, { type: "error" }> {
  if (err instanceof InputGuardrailTripwireTriggered) {
    return {
      type: "error",
      code: "guardrail_blocked",
      message: detectImpersonation(userMessage) ?? "I can't help with that request.",
    };
  }
  if (err instanceof OutputGuardrailTripwireTriggered) {
    return { type: "error", code: "guardrail_blocked", message: "I stopped that answer because it didn't meet TwinOS's honesty rules. Try rephrasing." };
  }
  if (err instanceof ModelTimeoutError || (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"))) {
    return { type: "error", code: "upstream_timeout", message: "The twin took too long to answer. Try again." };
  }
  if (err instanceof MaxTurnsExceededError) {
    return { type: "error", code: "internal", message: "The twin got stuck. Try a simpler question." };
  }
  console.error("[twin.stream] error", err);
  return { type: "error", code: "internal", message: "Something went wrong." };
}

const encoder = new TextEncoder();
const frame = (e: TwinStreamEvent) => encoder.encode(`data: ${JSON.stringify(e)}\n\n`);

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

/**
 * Agents SDK stream → our SSE protocol: `before` events (meta, evidence), text deltas,
 * then `done` (or `error`). `onComplete` runs after a successful finish (usage accounting).
 */
export function sseFromAgentStream(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: StreamedRunResult<any, any>,
  opts: { before: TwinStreamEvent[]; userMessage: string; onComplete?: () => Promise<void> },
): Response {
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      opts.before.forEach((e) => controller.enqueue(frame(e)));
      try {
        // The SDK's stream shim guarantees async iteration (not getReader) across runtimes.
        for await (const delta of result.toTextStream()) {
          if (delta) controller.enqueue(frame({ type: "text", delta }));
        }
        await result.completed;
        if (result.error) throw result.error;
        await opts.onComplete?.();
        controller.enqueue(frame({ type: "done" }));
      } catch (err) {
        controller.enqueue(frame(streamErrorEvent(err, opts.userMessage)));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}
