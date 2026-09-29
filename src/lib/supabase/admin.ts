import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * SECRET-KEY client: bypasses RLS. Plan §10 — import ONLY from cron handlers, connector
 * execution (paused_runs, action_proposals, connector tokens) and verified account deletion
 * (src/server/passport.ts: deletion_log + auth.admin.deleteUser).
 * Every query here must filter by user_id explicitly.
 */
export function createAdminClient() {
  const e = env();
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.SUPABASE_SECRET_KEY) {
    throw new Error("Supabase admin client is not configured (SUPABASE_SECRET_KEY)");
  }
  return createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
