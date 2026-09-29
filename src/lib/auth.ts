import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isMock } from "@/lib/env";
import { MOCK_USER_ID } from "@/lib/mock/fixtures";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { getProfile, type Profile } from "@/server/repos/profiles";

export type Viewer =
  | { mode: "mock"; userId: string; displayName: string }
  | { mode: "live"; userId: string; displayName: string; user: User; profile: Profile; supabase: ServerSupabase };

/** The current viewer for Server Components, or null when signed out. */
export async function getViewer(): Promise<Viewer | null> {
  // Viewer-dependent pages must render per request. Mock mode reads no cookies, so without
  // this Next would prerender them at build time and freeze the demo state.
  await connection();
  if (isMock()) return { mode: "mock", userId: MOCK_USER_ID, displayName: "Aria" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const profile = await getProfile(supabase, data.user.id);
  if (!profile) return null;
  return {
    mode: "live",
    userId: data.user.id,
    displayName: profile.displayName ?? data.user.email ?? "you",
    user: data.user,
    profile,
    supabase,
  };
}

/** Guard for (app) pages: signed in AND consented to the current version (plan §15). */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (viewer.mode === "live" && viewer.profile.needsConsent) redirect("/consent");
  return viewer;
}
