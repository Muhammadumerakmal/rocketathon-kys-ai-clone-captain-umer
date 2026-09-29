import { randomUUID } from "node:crypto";
import { DuelRoundRequest, type DuelRound } from "@/contracts";
import { buildTwinContext } from "@/lib/ai/context";
import { K_DUEL, predict } from "@/lib/ai/predict";
import { guardAiRequest, recordUsage } from "@/lib/budget";
import { duelById, nextScenario, publicScenario, revealedWeights, traitFitChoice, typicalChoice } from "@/lib/duel/scenarios";
import { scoreboard } from "@/lib/duel/score";
import { isMock } from "@/lib/env";
import { HttpError, parseJson, withApi } from "@/lib/http";
import { mockDelay } from "@/lib/mock";
import { mockAnswers, mockState } from "@/lib/mock/store";
import { requireUser } from "@/lib/supabase/server";
import { trainingProgress } from "@/lib/training/progress";
import { QUESTION_BANK } from "@/lib/training/questions";
import { scoreTraits } from "@/lib/training/score";
import { insertRound, listRounds } from "@/server/repos/duel";
import { categoryHistory, insertPrediction, resolvePrediction } from "@/server/repos/predictions";
import { upsertTraits } from "@/server/repos/traits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function state(rounds: DuelRound[]) {
  const played = new Set(rounds.map((r) => r.scenario.id));
  return { next: publicScenario(nextScenario(played)), scoreboard: scoreboard(rounds), rounds: rounds.slice(0, 10) };
}

export const GET = withApi(async () => {
  if (isMock()) return Response.json(state(mockState().duelRounds));
  const { supabase } = await requireUser();
  return Response.json(state(await listRounds(supabase)));
});

/** Play one round: the user's secret pick is locked in BEFORE the twin answers. */
export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, DuelRoundRequest);
  const scenario = duelById.get(body.scenarioId);
  if (!scenario || !scenario.options.includes(body.userChoice)) throw new HttpError("bad_request", "Unknown scenario or option.");

  if (isMock()) {
    await mockDelay(900);
    const traits = trainingProgress(QUESTION_BANK, mockAnswers()).traits;
    const twin = traitFitChoice(scenario, traits);
    const baselineChoice = typicalChoice(scenario);
    const round: DuelRound = {
      id: randomUUID(),
      scenario: publicScenario(scenario),
      userChoice: body.userChoice,
      twinChoice: twin.choice,
      twinDistribution: twin.distribution,
      baselineChoice,
      twinMatched: twin.choice === body.userChoice,
      baselineMatched: baselineChoice === body.userChoice,
    };
    mockState().duelRounds.unshift(round);
    // a duel is a resolved decision too: it goes in the same ledger as confirmed predictions
    mockState().resolutions.push({
      predictionId: round.id,
      scenario: scenario.scenario,
      at: new Date().toISOString(),
      category: scenario.category,
      confidence: Math.min(0.95, Math.max(0.05, Math.max(...Object.values(twin.distribution)))),
      actualChoice: body.userChoice,
      twinCorrect: round.twinMatched,
      baselineCorrect: round.baselineMatched,
    });
    return Response.json({ round, ...state(mockState().duelRounds) });
  }

  const { supabase, user } = await requireUser();
  await guardAiRequest(supabase, user.id);
  const [ctx, history] = await Promise.all([
    buildTwinContext(supabase, user.id, { query: scenario.scenario }),
    categoryHistory(supabase, scenario.category),
  ]);
  const { prediction, usage } = await predict(ctx, {
    id: randomUUID(),
    scenario: scenario.scenario,
    options: scenario.options,
    category: scenario.category,
    history,
    k: K_DUEL,
  });

  const round: DuelRound = {
    id: randomUUID(),
    scenario: publicScenario(scenario),
    userChoice: body.userChoice,
    twinChoice: prediction.topChoice,
    twinDistribution: prediction.distribution,
    baselineChoice: prediction.baseline.choice,
    twinMatched: prediction.topChoice === body.userChoice,
    baselineMatched: prediction.baseline.choice === body.userChoice,
  };

  // A duel is an already-resolved prediction: it counts toward calibration and lift.
  await insertPrediction(supabase, user.id, prediction, "duel");
  await resolvePrediction(supabase, {
    predictionId: prediction.id,
    verdict: round.twinMatched ? "correct" : "wrong",
    actualChoice: body.userChoice,
  });
  await insertRound(supabase, user.id, round, prediction.id);
  await recordUsage(supabase, usage);

  const rounds = await listRounds(supabase);
  const revealed = scoreTraits(
    revealedWeights(rounds.map((r) => ({ scenarioId: r.scenario.id, userChoice: r.userChoice }))),
    "revealed",
  );
  await upsertTraits(supabase, user.id, revealed.filter((t) => t.sampleCount > 0));

  return Response.json({ round, ...state(rounds) });
});
