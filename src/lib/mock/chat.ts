import "server-only";
import { randomUUID } from "node:crypto";
import type { PredictRequest, PredictStreamEvent, TwinChatRequest, TwinStreamEvent } from "@/contracts";
import { dedupeSuggestions, heuristicSuggestions } from "@/lib/ai/memory-suggest";
import { sseResponse } from "@/lib/ai/stream";
import { sleep } from "@/lib/http";
import { mockProposalStream, NOT_CONNECTED, wantsScheduling } from "./connectors";
import { chatStream } from "./fixtures";
import { mockPrediction } from "./predict";
import { mockCategoryHistory, mockState } from "./store";

const delay = (ms: number) => sleep(process.env.NODE_ENV === "test" ? 0 : ms);

/** Demo chat: same event order as live (status → evidence → text → approvals → memory). */
export function mockChat(body: TwinChatRequest): Response {
  return sseResponse<TwinStreamEvent>(async (send) => {
    const s = mockState();
    const thread = (body.chatId && s.threads.find((t) => t.id === body.chatId)) || null;
    const t = thread ?? { id: randomUUID(), title: body.message.slice(0, 80), createdAt: new Date().toISOString(), messages: [] };
    if (!thread) s.threads.unshift(t);
    t.messages.push({ role: "user", text: body.message });

    send({ type: "meta", chatId: t.id });
    send({ type: "status", step: "retrieving" });
    await delay(450);

    const scripted = wantsScheduling(body.message) ? (s.calendarConnected ? mockProposalStream(body.message) : NOT_CONNECTED) : chatStream;
    let reply = "";
    for (const e of scripted) {
      if (e.type === "meta" || e.type === "done") continue;
      if (e.type === "text") reply += e.delta;
      send(e);
      await delay(e.type === "text" ? 110 : 60);
    }
    t.messages.push({ role: "twin", text: reply });

    const suggestions = dedupeSuggestions(heuristicSuggestions(body.message), s.memories.map((m) => m.content));
    if (suggestions.length > 0) send({ type: "memory_suggestion", suggestions });
  });
}

/** Demo streaming prediction with the same real-step order as live. */
export function mockPredictStream(body: PredictRequest): Response {
  return sseResponse<PredictStreamEvent>(async (send) => {
    send({ type: "status", step: "retrieving" });
    await delay(350);
    for (let done = 0; done <= 5; done++) {
      send({ type: "status", step: "sampling", done, total: 5 });
      await delay(done === 0 ? 150 : 220);
    }
    send({ type: "status", step: "baseline" });
    await delay(250);
    const prediction = mockPrediction({ ...body, id: randomUUID(), history: mockCategoryHistory(body.category) });
    mockState().predictions.unshift(prediction);
    send({ type: "prediction", prediction });
  });
}
