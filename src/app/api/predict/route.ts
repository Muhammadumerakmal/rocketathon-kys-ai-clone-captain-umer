import { randomUUID } from "node:crypto";
import { PredictRequest } from "@/contracts";
import { NoValidSamplesError } from "@/lib/ai/assemble";
import { buildTwinContext } from "@/lib/ai/context";
import { extractOptions, predict } from "@/lib/ai/predict";
import { guardAiRequest, recordUsage } from "@/lib/budget";
import { isMock } from "@/lib/env";
import { HttpError, parseJson, withApi } from "@/lib/http";
import { mockDelay } from "@/lib/mock";
import { mockPrediction } from "@/lib/mock/predict";
import { mockCategoryHistory, mockState } from "@/lib/mock/store";
import { categoryHistory, insertPrediction } from "@/server/repos/predictions";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Prediction pipeline (plan §11.3): k samples + stranger baseline + app-computed confidence. */
export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, PredictRequest);
  if (isMock()) {
    await mockDelay(1200);
    const prediction = mockPrediction({ ...body, id: randomUUID(), history: mockCategoryHistory(body.category) });
    mockState().predictions.unshift(prediction);
    return Response.json(prediction);
  }

  const { supabase, user } = await requireUser();
  await guardAiRequest(supabase, user.id);

  let options = body.options;
  let category = body.category;
  if (!options) {
    const extracted = await extractOptions(body.scenario);
    options = extracted.options;
    if (category === "other") category = extracted.category;
    await recordUsage(supabase, extracted.usage);
  }

  const [ctx, history] = await Promise.all([
    buildTwinContext(supabase, user.id, { query: body.scenario, asOf: body.asOf }),
    categoryHistory(supabase, category),
  ]);

  try {
    const { prediction, usage } = await predict(ctx, {
      id: randomUUID(),
      scenario: body.scenario,
      options,
      category,
      history,
    });
    await insertPrediction(supabase, user.id, prediction);
    await recordUsage(supabase, usage);
    return Response.json(prediction);
  } catch (err) {
    if (err instanceof NoValidSamplesError) throw new HttpError("internal", "The twin couldn't settle on an option. Try rephrasing the options.");
    throw err;
  }
});
