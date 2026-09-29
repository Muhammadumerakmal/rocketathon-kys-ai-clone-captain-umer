import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

/**
 * Per-request server client acting AS the signed-in user (publishable key + session cookie),
 * so RLS applies to every query. This is the default for repos.
 */
export async function createClient() {
  const e = env();
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase is not configured");
  }
  const cookieStore = await cookies();

  return createServerClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * The verified user for this request. `getUser()` re-validates the JWT with Supabase Auth;
 * never trust `getSession()` on the server for authorization.
 */
export async function requireUser(supabase?: ServerSupabase) {
  const client = supabase ?? (await createClient());
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError("unauthorized", "Sign in to continue.");
  return { supabase: client, user: data.user };
}
