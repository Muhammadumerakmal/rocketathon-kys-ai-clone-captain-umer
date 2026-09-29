import { CouncilRequest } from "@/contracts";
import { buildTwinContext } from "@/lib/ai/context";
import { runCouncil } from "@/lib/ai/council";
import { guardAiRequest, recordUsage } from "@/lib/budget";
import { isMock } from "@/lib/env";
import { parseJson, withApi } from "@/lib/http";
import { fixtures, mockDelay } from "@/lib/mock";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Council v2 (plan §11.6): goal lenses + Devil's Advocate + synthesis (never a verdict). */
export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, CouncilRequest);
  if (isMock()) {
    await mockDelay(1500);
    return Response.json({ ...fixtures.council, question: body.question });
  }
  const { supabase, user } = await requireUser();
  await guardAiRequest(supabase, user.id);
  const ctx = await buildTwinContext(supabase, user.id, { query: body.question });
  const { usage, ...result } = await runCouncil(ctx, body.question);
  await recordUsage(supabase, usage);
  return Response.json(result);
});
