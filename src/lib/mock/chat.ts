import "server-only";
import { randomUUID } from "node:crypto";
import type { AnswerFeedbackRequest, Memory, MemoryUpdate, PredictRequest, PredictStreamEvent, TwinChatRequest, TwinStreamEvent } from "@/contracts";
import { CONFIDENCE, heuristicLearning, planUpsert, sourceFor, validateSignals } from "@/lib/ai/learning";
import { sseResponse } from "@/lib/ai/stream";
import { sleep } from "@/lib/http";
import { mockProposalStream, NOT_CONNECTED, wantsScheduling } from "./connectors";
import { mockPrediction } from "./predict";
import { mockCategoryHistory, mockState } from "./store";

const delay = (ms: number) => sleep(process.env.NODE_ENV === "test" ? 0 : ms);

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3));

/** Demo retrieval: keyword overlap stands in for embeddings; same "nothing relevant → none" rule. */
export function mockRelevant(message: string, memories: readonly Memory[], limit = 6): Memory[] {
  const q = words(message);
  return memories
    .filter((m) => m.influence === "active" && m.validTo === null)
    .map((m) => ({ m, hits: [...words(m.content)].filter((w) => q.has(w)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.m.confidence - a.m.confidence)
    .slice(0, limit)
    .map((x) => x.m);
}

/** Same validate → plan → apply path as live, against the in-memory store. */
export function mockApplyLearning(message: string, via: "conversation" | "feedback"): MemoryUpdate {
  const s = mockState();
  const learning = heuristicLearning(message);
  const update: MemoryUpdate = { explicit: via === "feedback" || learning.forget.length > 0, saved: [], reinforced: [], replaced: [], forgotten: [] };
  for (const signal of validateSignals(learning.signals)) {
    update.explicit ||= signal.explicit;
    const existing = s.memories.find((m) => m.category === signal.category && m.key === signal.key && m.validTo === null && m.influence !== "sealed");
    const plan = planUpsert(
      via === "feedback" ? { ...signal, explicit: true, confidence: CONFIDENCE.feedback } : signal,
      existing ? { id: existing.id, value: existing.summary, content: existing.content, confidence: existing.confidence, sourceType: existing.sourceType } : null,
    );
    if (plan.action === "skip") continue;
    if (plan.action === "reinforce") {
      if (existing) existing.confidence = Math.min(1, existing.confidence + plan.delta);
      update.reinforced.push(signal.statement);
      continue;
    }
    const now = new Date().toISOString();
    const memory: Memory = {
      id: randomUUID(),
      content: signal.statement,
      summary: signal.value, // demo keeps the normalized value here
      kind: signal.kind,
      sourceType: sourceFor(signal, via),
      importance: signal.confidence,
      validFrom: now,
      validTo: null,
      recordedAt: now,
      supersededBy: null,
      influence: "active",
      category: signal.category,
      key: signal.key,
      confidence: via === "feedback" ? CONFIDENCE.feedback : signal.confidence,
    };
    if (plan.action === "supersede" && existing) {
      existing.validTo = now;
      existing.supersededBy = memory.id;
      update.replaced.push({ from: existing.content, to: signal.statement });
    } else update.saved.push(signal.statement);
    s.memories.unshift(memory);
  }
  for (const what of learning.forget) {
    for (const m of mockRelevant(what, s.memories, 2)) {
      s.memories = s.memories.filter((x) => x.id !== m.id);
      update.forgotten.push(m.content);
    }
  }
  return update;
}

/** Demo chat: same event order as live (status → personalized → text → memory_update). */
export function mockChat(body: TwinChatRequest): Response {
  return sseResponse<TwinStreamEvent>(async (send) => {
    const s = mockState();
    const thread = (body.chatId && s.threads.find((t) => t.id === body.chatId)) || null;
    const t = thread ?? { id: randomUUID(), title: body.message.slice(0, 80), createdAt: new Date().toISOString(), messages: [] };
    if (!thread) s.threads.unshift(t);
    t.createdAt = new Date().toISOString();
    t.messages.push({ role: "user", text: body.message });

    send({ type: "meta", chatId: t.id });
    send({ type: "status", step: "retrieving" });
    await delay(350);
    const relevant = mockRelevant(body.message, s.memories);
    if (relevant.length > 0) {
      send({ type: "personalized", memories: relevant.map((m) => ({ id: m.id, label: m.content.slice(0, 140), category: m.category, confidence: m.confidence })) });
    }

    let reply = "";
    if (wantsScheduling(body.message)) {
      for (const e of s.calendarConnected ? mockProposalStream(body.message) : NOT_CONNECTED) {
        if (e.type === "meta" || e.type === "done") continue;
        if (e.type === "text") reply += e.delta;
        send(e);
        await delay(80);
      }
    } else {
      const text =
        relevant.length > 0
          ? `Based on what you've told me:\n\n${relevant.map((m) => `- ${m.content}`).join("\n")}\n\n_Demo mode: connect OpenAI + Supabase for real answers._`
          : "_Demo mode:_ I'd answer this normally here. Connect OpenAI + Supabase and your twin will reply for real — and learn from what you tell it.";
      for (const chunk of text.match(/.{1,24}(\s|$)/gs) ?? [text]) {
        reply += chunk;
        send({ type: "text", delta: chunk });
        await delay(40);
      }
    }
    t.messages.push({ role: "twin", text: reply });

    const update = mockApplyLearning(body.message, "conversation");
    if (update.explicit && (update.saved.length || update.replaced.length || update.forgotten.length || update.reinforced.length)) {
      send({ type: "memory_update", update });
    }
  });
}

/** Demo feedback: adjust confidence of the memories used; learn the correction. */
export function mockAnswerFeedback(body: AnswerFeedbackRequest): MemoryUpdate {
  const s = mockState();
  const delta = body.rating === "exactly" ? CONFIDENCE.reinforce : body.rating === "mostly" ? CONFIDENCE.reinforce / 2 : CONFIDENCE.contradict;
  for (const m of s.memories) if (body.memoryIds.includes(m.id)) m.confidence = Math.min(1, Math.max(0, m.confidence + delta));
  return body.correction && body.rating !== "exactly"
    ? mockApplyLearning(body.correction, "feedback")
    : { explicit: false, saved: [], reinforced: [], replaced: [], forgotten: [] };
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
