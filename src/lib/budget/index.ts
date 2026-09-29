import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

/**
 * Rate limit + per-user daily token budget (plan §10, rule 11).
 * Rate limiting is an in-process sliding window: fine for one instance / the hackathon.
 * Swap for @upstash/ratelimit when deploying to many serverless instances.
 */

const WINDOW_MS = 60_000;
export const AI_REQUESTS_PER_MINUTE = 30;
const hits = new Map<string, number[]>();

export function checkRateLimit(userId: string, limit = AI_REQUESTS_PER_MINUTE, now = Date.now()): void {
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(userId, recent);
    throw new HttpError("rate_limited", "Slow down a little — too many requests this minute.");
  }
  recent.push(now);
  hits.set(userId, recent);
}

/** Test helper. */
export function resetRateLimits() {
  hits.clear();
}

export async function checkBudget(sb: SupabaseClient): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb
    .from("usage_budget")
    .select("tokens_in,tokens_out")
    .eq("day", today)
    .maybeSingle<{ tokens_in: number; tokens_out: number }>();
  if (error) throw error;
  const used = (data?.tokens_in ?? 0) + (data?.tokens_out ?? 0);
  if (used >= env().TWIN_DAILY_TOKEN_BUDGET) {
    throw new HttpError("budget_exceeded", "Your twin has used today's thinking budget. It resets at midnight UTC.");
  }
}

/** Best-effort: a failed usage write must never fail the user's request. */
export async function recordUsage(sb: SupabaseClient, usage: { inputTokens: number; outputTokens: number }): Promise<void> {
  const { error } = await sb.rpc("record_usage", { p_tokens_in: usage.inputTokens, p_tokens_out: usage.outputTokens });
  if (error) console.warn("[budget] record_usage failed", error.message);
}

/** All guards an AI route runs before spending tokens. */
export async function guardAiRequest(sb: SupabaseClient, userId: string): Promise<void> {
  checkRateLimit(userId);
  await checkBudget(sb);
}
