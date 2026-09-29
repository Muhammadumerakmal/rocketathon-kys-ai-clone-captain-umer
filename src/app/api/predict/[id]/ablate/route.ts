import { Uuid, type EvidenceRef } from "@/contracts";
import { ablate } from "@/lib/ai/ablate";
import { buildTwinContext } from "@/lib/ai/context";
import { guardAiRequest, recordUsage } from "@/lib/budget";
import { isMock } from "@/lib/env";
import { HttpError, withApi } from "@/lib/http";
import { mockDelay } from "@/lib/mock";
import { mockState } from "@/lib/mock/store";
import { requireUser } from "@/lib/supabase/server";
import { getPrediction } from "@/server/repos/predictions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Counterfactual check, run after the card renders (F3). Returns evidence with pivotal flags. */
export const POST = withApi(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = Uuid.safeParse((await params).id);
  if (!id.success) throw new HttpError("bad_request", "Invalid prediction id.");

  if (isMock()) {
    await mockDelay(1500);
    const p = mockState().predictions.find((x) => x.id === id.data);
    if (!p) throw new HttpError("not_found", "Prediction not found.");
    // Demo: the most relevant memory is pivotal.
    p.evidence = p.evidence.map((e, i) => ({ ...e, pivotal: i === 0 }));
    return Response.json({ evidence: p.evidence });
  }

  const { supabase, user } = await requireUser();
  await guardAiRequest(supabase, user.id);
  const prediction = await getPrediction(supabase, id.data);
  if (!prediction) throw new HttpError("not_found", "Prediction not found.");
  if (prediction.evidence.length === 0) return Response.json({ evidence: [] });

  const ctx = await buildTwinContext(supabase, user.id, { query: prediction.scenario, asOf: prediction.asOf });
  const { pivotalIds, usage } = await ablate(ctx, prediction);
  await recordUsage(supabase, usage);

  const { data, error } = await supabase.rpc("set_pivotal_evidence", { p_prediction_id: prediction.id, p_pivotal_ids: pivotalIds });
  if (error) throw error;
  return Response.json({ evidence: data as EvidenceRef[] });
});
