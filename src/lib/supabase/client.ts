"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client: publishable key only, every query goes through RLS.
 * Use for auth UI and realtime; data writes go through our API routes.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY)");
  return createBrowserClient(url, key);
}
