import { timingSafeEqual } from "node:crypto";
import { env, isMock } from "@/lib/env";
import { HttpError, withApi } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Constant-time compare. */
function authorized(req: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Weekly job (vercel.json): snapshot every recently-active user's Decision DNA so the
 * dashboard can chart drift (F8). Outcome check-ins need no job: they're rows with a
 * due_at, shown in-app once due.
 */
export const GET = withApi(async (req: Request) => {
  if (!authorized(req)) throw new HttpError("unauthorized", "Bad cron secret.");
  if (isMock()) return Response.json({ ok: true, snapshotted: 0, mode: "mock" });

  const admin = createAdminClient();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("decision_traits")
    .select("user_id,trait,source,score")
    .gte("updated_at", since)
    .gt("sample_count", 0)
    .returns<{ user_id: string; trait: string; source: string; score: number }[]>();
  if (error) throw error;

  if (data.length > 0) {
    const { error: insErr } = await admin.from("trait_snapshots").insert(data);
    if (insErr) throw insErr;
  }
  return Response.json({ ok: true, snapshotted: data.length, users: new Set(data.map((d) => d.user_id)).size });
});
