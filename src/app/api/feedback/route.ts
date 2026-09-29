import { FeedbackRequest } from "@/contracts";
import { isMock } from "@/lib/env";
import { HttpError, parseJson, withApi } from "@/lib/http";
import { mockDelay } from "@/lib/mock";
import { mockState } from "@/lib/mock/store";
import { insertMemory } from "@/server/repos/memories";
import { getPrediction, resolvePrediction } from "@/server/repos/predictions";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Correction loop (plan §11.5): resolve (atomic SQL) → calibration → outcome check-in,
 * then store the real choice as an episodic memory so the twin learns from it.
 */
export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, FeedbackRequest);
  if (isMock()) {
    await mockDelay(400);
    const s = mockState();
    const p = s.predictions.find((x) => x.id === body.predictionId);
    if (!p) throw new HttpError("not_found", "Prediction not found.");
    if (p.status === "resolved") throw new HttpError("bad_request", "Already resolved.");
    const twinCorrect = body.verdict === "correct";
    const baselineCorrect = p.baseline.choice === body.actualChoice;
    p.status = "resolved";
    s.resolutions.push({ predictionId: p.id, category: p.category, confidence: p.confidence.value, actualChoice: body.actualChoice, twinCorrect, baselineCorrect });
    return Response.json({ ok: true, twinCorrect, baselineCorrect });
  }

  const { supabase, user } = await requireUser();
  const prediction = await getPrediction(supabase, body.predictionId);
  if (!prediction) throw new HttpError("not_found", "Prediction not found.");
  if (!prediction.options.includes(body.actualChoice) && body.verdict === "correct") {
    throw new HttpError("bad_request", "A correct prediction's actual choice must be one of its options.");
  }

  const fb = await resolvePrediction(supabase, body);

  const others = prediction.options.filter((o) => o !== body.actualChoice);
  await insertMemory(supabase, user.id, {
    content: `Chose "${body.actualChoice}"${others.length ? ` over ${others.map((o) => `"${o}"`).join(", ")}` : ""} when facing: ${prediction.scenario}${body.note ? ` — ${body.note}` : ""}`.slice(0, 4000),
    kind: "episodic",
    sourceType: "feedback",
    sourceRef: prediction.id,
    importance: 0.7,
  });

  return Response.json({ ok: true, twinCorrect: fb.twin_correct, baselineCorrect: fb.baseline_correct });
});
