import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanEnvValue, env, missingLiveEnv, normalizeEnv, resetEnvCache } from "@/lib/env";
import { publicSupabaseEnv } from "@/lib/supabase/public-env";

const LIVE = {
  OPENAI_API_KEY: "sk-test",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
};

function withEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
  resetEnvCache();
}

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

describe("cleanEnvValue", () => {
  it("treats empty and whitespace as unset", () => {
    expect(cleanEnvValue("")).toBeUndefined();
    expect(cleanEnvValue("   ")).toBeUndefined();
    expect(cleanEnvValue(undefined)).toBeUndefined();
  });

  it("drops a trailing inline comment and matching quotes", () => {
    expect(cleanEnvValue("low          # minimal | low")).toBe("low");
    expect(cleanEnvValue('"gpt-5"')).toBe("gpt-5");
    expect(cleanEnvValue("https://x.supabase.co#frag")).toBe("https://x.supabase.co#frag");
  });
});

describe("normalizeEnv", () => {
  it("accepts the Vercel Supabase integration's key names as fallbacks", () => {
    const e = normalizeEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service" });
    expect(e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("anon");
    expect(e.SUPABASE_SECRET_KEY).toBe("service");
  });

  it("prefers the new key names when both are set", () => {
    const e = normalizeEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" });
    expect(e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("pub");
  });

  it("derives the app URL from Vercel and adds a missing scheme", () => {
    expect(normalizeEnv({ VERCEL_URL: "twin-abc.vercel.app" }).NEXT_PUBLIC_APP_URL).toBe("https://twin-abc.vercel.app");
    expect(normalizeEnv({ NEXT_PUBLIC_SUPABASE_URL: "abc.supabase.co/" }).NEXT_PUBLIC_SUPABASE_URL).toBe("https://abc.supabase.co");
  });
});

describe("env() mode", () => {
  it("auto-selects mock when TWIN_MOCK is unset and keys are missing", () => {
    withEnv({ TWIN_MOCK: undefined, OPENAI_API_KEY: undefined, NEXT_PUBLIC_SUPABASE_URL: undefined });
    expect(env().TWIN_MOCK).toBe(true);
    expect(missingLiveEnv()).toContain("OPENAI_API_KEY");
  });

  it("auto-selects live when TWIN_MOCK is empty and every live key is present", () => {
    withEnv({ ...LIVE, TWIN_MOCK: "" });
    expect(env().TWIN_MOCK).toBe(false);
    expect(missingLiveEnv()).toEqual([]);
  });

  it("goes live with the integration's anon key", () => {
    withEnv({ ...LIVE, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", TWIN_MOCK: undefined });
    expect(env().TWIN_MOCK).toBe(false);
    expect(env().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("anon");
  });

  it("throws on explicit TWIN_MOCK=0 with missing keys", () => {
    withEnv({ TWIN_MOCK: "0", OPENAI_API_KEY: undefined });
    expect(() => env()).toThrow(/OPENAI_API_KEY/);
  });

  it("survives empty optional values pasted from .env.example", () => {
    withEnv({ TWIN_MOCK: "1", TWIN_REASONING_EFFORT: "", TWIN_DAILY_TOKEN_BUDGET: "", NEXT_PUBLIC_APP_URL: "", TWIN_MODEL_PRIMARY: "" });
    const e = env();
    expect(e.TWIN_REASONING_EFFORT).toBe("low");
    expect(e.TWIN_DAILY_TOKEN_BUDGET).toBe(200_000);
    expect(e.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(e.TWIN_MODEL_PRIMARY).toBe("gpt-5");
  });
});

describe("publicSupabaseEnv", () => {
  it("falls back to the anon key and is null when unconfigured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(publicSupabaseEnv()).toEqual({ url: "https://abc.supabase.co", key: "anon" });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(publicSupabaseEnv()).toBeNull();
  });

  it("cleans values the same way the server env does", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ' "abc.supabase.co/" ');
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "'sb_publishable_x'   # from the dashboard");
    expect(publicSupabaseEnv()).toEqual({ url: "https://abc.supabase.co", key: "sb_publishable_x" });
  });
});
