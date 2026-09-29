import { isMock } from "@/lib/env";
import { withApi } from "@/lib/http";
import { fixtures } from "@/lib/mock";
import { openRevisions } from "@/server/repos/revisions";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Belief Revision Inbox: unresolved contradictions. */
export const GET = withApi(async () => {
  if (isMock()) return Response.json({ revisions: [fixtures.revision] });
  const { supabase } = await requireUser();
  return Response.json({ revisions: await openRevisions(supabase) });
});
