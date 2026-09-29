import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { publicSupabaseEnv } from "./public-env";

/**
 * Refreshes the Supabase session cookie on every request (the only job of proxy.ts, plan §4).
 * No-op when Supabase isn't configured (mock mode).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cfg = publicSupabaseEnv();
  if (!cfg) return response;

  const supabase = createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Don't put code between createServerClient and getUser: it's what triggers the refresh.
  // A Supabase outage or bad URL must not take down every page: pages re-check auth anyway.
  try {
    await supabase.auth.getUser();
  } catch (err) {
    console.error("[proxy] session refresh failed", err);
  }
  return response;
}
