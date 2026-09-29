import { UpdateMemoryRequest, Uuid } from "@/contracts";
import { embed } from "@/lib/ai/embeddings";
import { isMock } from "@/lib/env";
import { HttpError, parseJson, withApi } from "@/lib/http";
import { fixtures } from "@/lib/mock";
import { deleteMemory, getMemories, toVectorLiteral, updateMemory } from "@/server/repos/memories";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function memoryId(params: Params["params"]) {
  const parsed = Uuid.safeParse((await params).id);
  if (!parsed.success) throw new HttpError("bad_request", "Invalid memory id.");
  return parsed.data;
}

/** Edit / mute / seal / unseal. Unsealing re-embeds so the memory becomes searchable again. */
export const PATCH = withApi(async (req: Request, { params }: Params) => {
  const id = await memoryId(params);
  const body = await parseJson(req, UpdateMemoryRequest);
  if (isMock()) return Response.json({ memory: { ...fixtures.memories[0]!, id, ...body } });

  const { supabase } = await requireUser();
  const [current] = await getMemories(supabase, [id]);
  if (!current) throw new HttpError("not_found", "Memory not found.");

  const memory = await updateMemory(supabase, id, {
    ...(body.content !== undefined && { content: body.content }),
    ...(body.kind !== undefined && { kind: body.kind }),
    ...(body.importance !== undefined && { importance: body.importance }),
    ...(body.influence !== undefined && { influence: body.influence }),
  });

  const nowActive = (body.influence ?? current.influence) !== "sealed";
  const needsEmbedding = nowActive && (body.content !== undefined || (current.influence === "sealed" && body.influence !== undefined));
  if (needsEmbedding) {
    const vector = await embed(memory.content);
    if (vector) await supabase.from("memories").update({ embedding: toVectorLiteral(vector) }).eq("id", id);
  }
  return Response.json({ memory });
});

export const DELETE = withApi(async (_req: Request, { params }: Params) => {
  const id = await memoryId(params);
  if (isMock()) return new Response(null, { status: 204 });
  const { supabase } = await requireUser();
  await deleteMemory(supabase, id);
  return new Response(null, { status: 204 });
});
