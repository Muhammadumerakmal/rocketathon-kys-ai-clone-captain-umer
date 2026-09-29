import { isMock } from "@/lib/env";
import { withApi } from "@/lib/http";
import { mockState } from "@/lib/mock/store";
import { requireUser } from "@/lib/supabase/server";
import { AI_LABEL, exportPassport } from "@/server/passport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Twin Passport download: every row TwinOS holds about you, as JSON. */
export const GET = withApi(async () => {
  const stamp = new Date().toISOString().slice(0, 10);
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="twinos-passport-${stamp}.json"`,
    "Cache-Control": "no-store",
  };

  if (isMock()) {
    const s = mockState();
    const body = {
      format: "twinos-passport@1",
      exportedAt: new Date().toISOString(),
      notice: AI_LABEL,
      demo: true,
      data: { memories: s.memories, predictions: s.predictions.map((p) => ({ ...p, _label: AI_LABEL })), duel_rounds: s.duelRounds, training_answers: [...s.answers.values()] },
    };
    return new Response(JSON.stringify(body, null, 2), { headers });
  }

  const { supabase, user } = await requireUser();
  return new Response(JSON.stringify(await exportPassport(supabase, user.id), null, 2), { headers });
});
