import { z } from "zod";
import { isMock } from "@/lib/env";
import { parseJson, withApi } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { deleteEverything } from "@/server/passport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DeleteRequest = z.object({ confirm: z.literal("DELETE") });

/** Verified delete-all (plan §15). Requires typing DELETE. */
export const DELETE = withApi(async (req: Request) => {
  await parseJson(req, DeleteRequest);
  if (isMock()) {
    (globalThis as { __twinMock?: unknown }).__twinMock = undefined; // demo: reset to a fresh state
    return Response.json({ ok: true, rowsDeleted: {} });
  }
  const { supabase, user } = await requireUser();
  const { rowsDeleted } = await deleteEverything(supabase, user.id);
  await supabase.auth.signOut();
  return Response.json({ ok: true, rowsDeleted });
});
