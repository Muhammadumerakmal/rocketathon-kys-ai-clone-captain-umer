import { ResolveRevisionRequest, Uuid } from "@/contracts";
import { isMock } from "@/lib/env";
import { HttpError, parseJson, withApi } from "@/lib/http";
import { resolveRevision } from "@/lib/memory/resolve";
import { mockDelay } from "@/lib/mock";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = Uuid.safeParse((await params).id);
  if (!id.success) throw new HttpError("bad_request", "Invalid revision id.");
  const body = await parseJson(req, ResolveRevisionRequest);
  if (isMock()) {
    await mockDelay(300);
    return Response.json({ ok: true });
  }
  const { supabase } = await requireUser();
  await resolveRevision(supabase, id.data, body);
  return Response.json({ ok: true });
});
