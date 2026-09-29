import "server-only";
import { z } from "zod";
import { cleanEnvValue, withScheme } from "./supabase/public-env";

export { cleanEnvValue };

/**
 * Server environment, validated once on first use. Secrets live only here.
 * In mock mode (TWIN_MOCK=1) provider keys are optional, so the UI runs with no keys at all.
 *
 * Deploy-friendly on purpose (Vercel):
 * - values are trimmed, a trailing `  # comment` is dropped and empty strings count as unset,
 *   so pasting `.env.example` into the dashboard can't crash every page;
 * - the Supabase ↔ Vercel integration's names (`NEXT_PUBLIC_SUPABASE_ANON_KEY`,
 *   `SUPABASE_SERVICE_ROLE_KEY`) are accepted as fallbacks for the new key names;
 * - `NEXT_PUBLIC_APP_URL` falls back to the Vercel deployment URL;
 * - TWIN_MOCK unset = auto: live when every live key is present, otherwise mock (with a warning).
 *   Set TWIN_MOCK=0 to make missing keys a hard error instead.
 */
const flag = z.enum(["0", "1", "true", "false"]).transform((v) => v === "1" || v === "true");

const ServerEnv = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),

  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  TWIN_MODEL_PRIMARY: z.string().default("gpt-5"),
  TWIN_MODEL_FAST: z.string().default("gpt-5-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  /** Reasoning effort for PRIMARY calls (predict, simulator, synthesis). Lower = faster. */
  TWIN_REASONING_EFFORT: z.enum(["minimal", "low", "medium", "high"]).default("low"),
  TWIN_REALTIME_MODEL: z.string().optional(),

  APPROVAL_HMAC_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  TWIN_DAILY_TOKEN_BUDGET: z.coerce.number().int().positive().default(200_000),

  TWIN_MOCK: flag.optional(),
  TWIN_REPLAY: flag.default(false),
});

export type ServerEnv = Omit<z.infer<typeof ServerEnv>, "TWIN_MOCK"> & { TWIN_MOCK: boolean };

/** What live mode can't run without. */
const LIVE_REQUIRED = ["OPENAI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] as const;

/** Cleaned process.env with the fallbacks above applied. */
export function normalizeEnv(raw: Record<string, string | undefined>): Record<string, string | undefined> {
  const src: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) src[k] = cleanEnvValue(v);
  const vercelHost = src.VERCEL_PROJECT_PRODUCTION_URL ?? src.VERCEL_URL;
  return {
    ...src,
    NEXT_PUBLIC_APP_URL: withScheme(src.NEXT_PUBLIC_APP_URL ?? vercelHost),
    NEXT_PUBLIC_SUPABASE_URL: withScheme(src.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: src.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? src.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SECRET_KEY: src.SUPABASE_SECRET_KEY ?? src.SUPABASE_SERVICE_ROLE_KEY,
  };
}

let cached: ServerEnv | undefined;
let missingLive: string[] = [];

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnv.safeParse(normalizeEnv(process.env));
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  missingLive = LIVE_REQUIRED.filter((k) => !e[k]);

  let mock: boolean;
  if (e.TWIN_MOCK !== undefined) {
    mock = e.TWIN_MOCK;
    if (!mock && missingLive.length) {
      throw new Error(`Missing env vars (or set TWIN_MOCK=1): ${missingLive.join(", ")}`);
    }
  } else {
    mock = missingLive.length > 0;
    if (mock && e.NODE_ENV !== "test") {
      console.warn(`[env] TWIN_MOCK is unset and ${missingLive.join(", ")} missing: running in demo (mock) mode.`);
    }
  }
  cached = { ...e, TWIN_MOCK: mock };
  return cached;
}

export const isMock = () => env().TWIN_MOCK;

/** Names (never values) of live-mode vars that are missing. For /api/health. */
export function missingLiveEnv(): string[] {
  env();
  return [...missingLive];
}

/** Test helper: forget the cached env so a test can change process.env. */
export function resetEnvCache() {
  cached = undefined;
  missingLive = [];
}
