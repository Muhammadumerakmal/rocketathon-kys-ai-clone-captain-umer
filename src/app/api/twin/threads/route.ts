import { isMock } from "@/lib/env";
import { withApi } from "@/lib/http";
import { mockState } from "@/lib/mock/store";
import { requireUser } from "@/lib/supabase/server";
import { listChats } from "@/server/repos/chats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Thread history for the Ask screen (ChatKit-style history sheet). */
export const GET = withApi(async () => {
  if (isMock()) {
    return Response.json({ threads: mockState().threads.map(({ id, title, createdAt }) => ({ id, title, createdAt })) });
  }
  const { supabase } = await requireUser();
  return Response.json({ threads: await listChats(supabase) });
});
