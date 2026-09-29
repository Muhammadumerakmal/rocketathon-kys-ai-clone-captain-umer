import { env, missingLiveEnv } from "@/lib/env";
import { withApi } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness + which mode the AI layer runs in. Names missing vars, never exposes values. */
export const GET = withApi(async () => {
  const e = env();
  return Response.json({
    ok: true,
    mode: e.TWIN_MOCK ? "mock" : e.TWIN_REPLAY ? "replay" : "live",
    supabaseConfigured: Boolean(e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    supabaseAdminConfigured: Boolean(e.SUPABASE_SECRET_KEY),
    openaiConfigured: Boolean(e.OPENAI_API_KEY),
    missing: missingLiveEnv(),
  });
});
