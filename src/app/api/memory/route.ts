import { CreateMemoryRequest } from "@/contracts";
import { ingestMemory } from "@/lib/ai/ingest";
import { guardAiRequest } from "@/lib/budget";
import { isMock } from "@/lib/env";
import { parseJson, withApi } from "@/lib/http";
import { fixtures, mockDelay } from "@/lib/mock";
import { listMemories } from "@/server/repos/memories";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  if (isMock()) return Response.json({ memories: fixtures.memories });
  const { supabase } = await requireUser();
  return Response.json({ memories: await listMemories(supabase) });
});

/** Ingest a memory: classify → embed → belief revision (plan §11.2). */
export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, CreateMemoryRequest);
  if (isMock()) {
    await mockDelay(800);
    return Response.json(
      { memory: { ...fixtures.memories[1]!, content: body.content, influence: body.influence }, duplicateOf: null, contradictions: 1, sensitive: false, flaggedInjection: false },
      { status: 201 },
    );
  }
  const { supabase, user } = await requireUser();
  if (body.influence !== "sealed") await guardAiRequest(supabase, user.id);
  const result = await ingestMemory(supabase, user.id, body);
  return Response.json(result, { status: result.memory ? 201 : 200 });
});
