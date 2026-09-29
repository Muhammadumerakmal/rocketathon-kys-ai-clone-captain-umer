import { randomUUID } from "node:crypto";
import { CreateMemoryRequest, type Memory } from "@/contracts";
import { ingestMemory } from "@/lib/ai/ingest";
import { guardAiRequest } from "@/lib/budget";
import { isMock } from "@/lib/env";
import { parseJson, withApi } from "@/lib/http";
import { mockDelay } from "@/lib/mock";
import { mockState } from "@/lib/mock/store";
import { requireUser } from "@/lib/supabase/server";
import { listMemories } from "@/server/repos/memories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  if (isMock()) return Response.json({ memories: mockState().memories });
  const { supabase } = await requireUser();
  return Response.json({ memories: await listMemories(supabase) });
});

/** Ingest a memory: classify → embed → belief revision (plan §11.2). */
export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, CreateMemoryRequest);

  if (isMock()) {
    await mockDelay(600);
    const now = new Date().toISOString();
    const memory: Memory = {
      id: randomUUID(),
      content: body.content,
      summary: null,
      kind: body.kind ?? "semantic",
      sourceType: "manual",
      importance: 0.5,
      validFrom: body.validFrom ?? now,
      validTo: null,
      recordedAt: now,
      supersededBy: null,
      influence: body.influence,
    };
    mockState().memories.unshift(memory);
    return Response.json({ memory, duplicateOf: null, contradictions: 0, sensitive: false, flaggedInjection: false }, { status: 201 });
  }

  const { supabase, user } = await requireUser();
  if (body.influence !== "sealed") await guardAiRequest(supabase, user.id);
  const result = await ingestMemory(supabase, user.id, body);
  return Response.json(result, { status: result.memory ? 201 : 200 });
});
