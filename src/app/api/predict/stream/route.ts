import { randomUUID } from "node:crypto";
import { PredictRequest, type PredictStreamEvent } from "@/contracts";
import { NoValidSamplesError } from "@/lib/ai/assemble";
import { buildTwinContext } from "@/lib/ai/context";
import { extractOptions, predict } from "@/lib/ai/predict";
import { sseResponse } from "@/lib/ai/stream";
import { guardAiRequest, recordUsage } from "@/lib/budget";
import { isMock } from "@/lib/env";
import { HttpError, parseJson, withApi } from "@/lib/http";
import { mockPredictStream } from "@/lib/mock/chat";
import { requireUser } from "@/lib/supabase/server";
import { categoryHistory, insertPrediction } from "@/server/repos/predictions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Streaming prediction for the Ask screen (UI/UX plan §6.4): real steps only —
 * retrieving → sampling (done/total as each of the k runs settles) → baseline → prediction.
 */
export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, PredictRequest);
  if (isMock()) return mockPredictStream(body);

  const { supabase, user } = await requireUser();
  await guardAiRequest(supabase, user.id);

  return sseResponse<PredictStreamEvent>(async (send) => {
    send({ type: "status", step: "retrieving" });
    let options = body.options;
    let category = body.category;
    if (!options) {
      const extracted = await extractOptions(body.scenario).catch(() => null);
      if (!extracted) throw new HttpError("bad_request", "Give me two options, like 'stay or go', and I'll predict which one you'd pick.");
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
        onProgress: (e) => send({ type: "status", ...e }),
      });
      await insertPrediction(supabase, user.id, prediction);
      await recordUsage(supabase, usage);
      send({ type: "prediction", prediction });
    } catch (err) {
      if (err instanceof NoValidSamplesError) throw new HttpError("internal", "Your twin couldn't settle on an option. Try rephrasing the options.");
      throw err;
    }
  }, { userMessage: body.scenario });
});
