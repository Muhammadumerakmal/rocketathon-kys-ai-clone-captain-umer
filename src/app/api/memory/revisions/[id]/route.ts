import { ResolveRevisionRequest, Uuid } from "@/contracts";
import { isMock } from "@/lib/env";
import { HttpError, parseJson, withApi } from "@/lib/http";
import { resolveRevision } from "@/lib/memory/resolve";
import { mockResolveRevision } from "@/lib/mock/store";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = Uuid.safeParse((await params).id);
  if (!id.success) throw new HttpError("bad_request", "Invalid revision id.");
  const body = await parseJson(req, ResolveRevisionRequest);
  if (body.resolution === "both_true" && !body.qualifiers) throw new HttpError("bad_request", "Say when each one is true.");

  if (isMock()) {
    if (!mockResolveRevision(id.data, body)) throw new HttpError("not_found", "Revision not found.");
    return Response.json({ ok: true });
  }
  const { supabase } = await requireUser();
  await resolveRevision(supabase, id.data, body);
  return Response.json({ ok: true });
});
