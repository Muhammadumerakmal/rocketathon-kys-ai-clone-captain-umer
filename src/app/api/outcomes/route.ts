import { OutcomeCheckin } from "@/contracts";
import { embed } from "@/lib/ai/embeddings";
import { isMock } from "@/lib/env";
import { HttpError, parseJson, withApi } from "@/lib/http";
import { mockState } from "@/lib/mock/store";
import { requireUser } from "@/lib/supabase/server";
import { insertMemory } from "@/server/repos/memories";
import { answerCheckin, dueCheckins, outcomeMemory } from "@/server/repos/outcomes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Outcome check-ins (F7): how did the decision actually turn out? */
export const GET = withApi(async () => {
  if (isMock()) return Response.json({ checkins: mockState().checkins });
  const { supabase } = await requireUser();
  return Response.json({ checkins: await dueCheckins(supabase) });
});

export const POST = withApi(async (req: Request) => {
  const body = await parseJson(req, OutcomeCheckin);

  if (isMock()) {
    const s = mockState();
    const c = s.checkins.find((x) => x.predictionId === body.predictionId);
    if (!c) throw new HttpError("not_found", "No open check-in for that decision.");
    s.checkins = s.checkins.filter((x) => x !== c);
    s.memories.unshift({
      id: crypto.randomUUID(),
      content: outcomeMemory(c.scenario, body),
      summary: null,
      kind: "episodic",
      sourceType: "outcome",
      importance: body.regret ? 0.9 : 0.7,
      validFrom: new Date().toISOString(),
      validTo: null,
      recordedAt: new Date().toISOString(),
      supersededBy: null,
      influence: "active",
    });
    return Response.json({ ok: true });
  }

  const { supabase, user } = await requireUser();
  const answered = await answerCheckin(supabase, body);
  if (!answered) throw new HttpError("not_found", "No open check-in for that decision.");
  const content = outcomeMemory(answered.scenario, body);
  await insertMemory(supabase, user.id, {
    content,
    kind: "episodic",
    sourceType: "outcome",
    sourceRef: body.predictionId,
    // Regret is the strongest learning signal: weight it higher.
    importance: body.regret ? 0.9 : 0.7,
    embedding: await embed(content),
  });
  return Response.json({ ok: true });
});
