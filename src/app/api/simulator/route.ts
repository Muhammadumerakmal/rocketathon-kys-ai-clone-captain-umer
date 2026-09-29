import { SimulatorRequest } from "@/contracts";
import { buildTwinContext } from "@/lib/ai/context";
import { simulate } from "@/lib/ai/simulate";
import { guardAiRequest, recordUsage } from "@/lib/budget";
import { isMock } from "@/lib/env";
import { parseJson, withApi } from "@/lib/http";
import { fixtures, mockDelay } from "@/lib/mock";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Simulator v2 (plan §11.7): A vs B as a scenario simulation, not a forecast. */
export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, SimulatorRequest);
  if (isMock()) {
    await mockDelay(1500);
    const s = fixtures.simulation;
    return Response.json({ simulation: { ...s, optionA: { ...s.optionA, label: body.optionA }, optionB: { ...s.optionB, label: body.optionB } }, goals: [] });
  }
  const { supabase, user } = await requireUser();
  await guardAiRequest(supabase, user.id);
  const ctx = await buildTwinContext(supabase, user.id, { query: `${body.optionA} vs ${body.optionB}. ${body.context}` });
  const { simulation, usage } = await simulate(ctx, body);
  await recordUsage(supabase, usage);
  return Response.json({ simulation, goals: ctx.profile.goals.map((g) => ({ id: g.id, title: g.title })) });
});
