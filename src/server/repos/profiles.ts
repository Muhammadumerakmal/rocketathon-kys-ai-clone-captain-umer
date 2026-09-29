import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Bump when the consent text changes; users with an older version are asked again (plan §15). */
export const CONSENT_VERSION = "2026-09-29";

export interface Profile {
  id: string;
  displayName: string | null;
  twinName: string | null;
  onboardingCompleted: boolean;
  consentVersion: string | null;
  needsConsent: boolean;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  twin_name: string | null;
  onboarding_completed: boolean;
  consent_version: string | null;
}

export async function getProfile(sb: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await sb
    .from("profiles")
    .select("id,display_name,twin_name,onboarding_completed,consent_version")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    displayName: data.display_name,
    twinName: data.twin_name,
    onboardingCompleted: data.onboarding_completed,
    consentVersion: data.consent_version,
    needsConsent: data.consent_version !== CONSENT_VERSION,
  };
}

/** Record consent on the profile and in the append-only consent ledger. */
export async function grantConsent(sb: SupabaseClient, userId: string, euUser: boolean): Promise<void> {
  const now = new Date().toISOString();
  const { error: e1 } = await sb
    .from("profiles")
    .update({ consent_version: CONSENT_VERSION, consented_at: now, eu_user: euUser })
    .eq("id", userId);
  if (e1) throw e1;
  const { error: e2 } = await sb.from("consent_ledger").insert({
    user_id: userId,
    event: "grant",
    scope: "core",
    detail: { version: CONSENT_VERSION },
  });
  if (e2) throw e2;
}
