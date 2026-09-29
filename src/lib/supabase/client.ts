"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicSupabaseEnv } from "./public-env";

/**
 * Browser client: publishable key only, every query goes through RLS.
 * Use for auth UI and realtime; data writes go through our API routes.
 */
export function createClient() {
  const cfg = publicSupabaseEnv();
  if (!cfg) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY)");
  return createBrowserClient(cfg.url, cfg.key);
}
