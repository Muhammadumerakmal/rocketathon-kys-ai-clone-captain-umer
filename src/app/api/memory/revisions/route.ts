import { isMock } from "@/lib/env";
import { withApi } from "@/lib/http";
import { mockState } from "@/lib/mock/store";
import { requireUser } from "@/lib/supabase/server";
import { openRevisions } from "@/server/repos/revisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Belief Revision Inbox: unresolved contradictions. */
export const GET = withApi(async () => {
  if (isMock()) return Response.json({ revisions: mockState().revisions });
  const { supabase } = await requireUser();
  return Response.json({ revisions: await openRevisions(supabase) });
});
