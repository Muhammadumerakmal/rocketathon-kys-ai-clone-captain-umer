import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once on first use. Secrets live only here.
 * In mock mode (TWIN_MOCK=1) provider keys are optional, so the UI runs with no keys at all.
 */
const flag = z
  .enum(["0", "1", "true", "false", ""])
  .default("0")
  .transform((v) => v === "1" || v === "true");

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const ServerEnv = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),

  NEXT_PUBLIC_SUPABASE_URL: optional,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optional,
  SUPABASE_SECRET_KEY: optional,

  OPENAI_API_KEY: optional,
  TWIN_MODEL_PRIMARY: z.string().default("gpt-5"),
  TWIN_MODEL_FAST: z.string().default("gpt-5-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  TWIN_REALTIME_MODEL: optional,

  APPROVAL_HMAC_SECRET: optional,
  CRON_SECRET: optional,

  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,
  TWIN_DAILY_TOKEN_BUDGET: z.coerce.number().int().positive().default(200_000),

  TWIN_MOCK: flag,
  TWIN_REPLAY: flag,
});

export type ServerEnv = z.infer<typeof ServerEnv>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnv.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  if (!e.TWIN_MOCK) {
    const missing = (["OPENAI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] as const).filter(
      (k) => !e[k],
    );
    if (missing.length) {
      throw new Error(`Missing env vars (or set TWIN_MOCK=1): ${missing.join(", ")}`);
    }
  }
  cached = e;
  return e;
}

export const isMock = () => env().TWIN_MOCK;

/** Test helper: forget the cached env so a test can change process.env. */
export function resetEnvCache() {
  cached = undefined;
}
