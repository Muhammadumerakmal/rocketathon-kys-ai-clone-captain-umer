import "server-only";
import type { TwinStreamEvent } from "@/contracts";
import { sleep } from "@/lib/http";

export * as fixtures from "./fixtures";

/** Realistic latency so loading states get exercised in mock mode. */
export const mockDelay = (ms = 600) => sleep(process.env.NODE_ENV === "test" ? 0 : ms);

export function sseEncode(event: TwinStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Replay a recorded event list as an SSE response. */
export function mockSseResponse(events: readonly TwinStreamEvent[], stepMs = 120): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const e of events) {
        controller.enqueue(encoder.encode(sseEncode(e)));
        await mockDelay(stepMs);
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
