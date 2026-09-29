/**
 * Supabase URL + browser key, safe for client bundles, next.config and the proxy.
 * `NEXT_PUBLIC_*` must be read with literal property access so Next inlines them at build time.
 * Accepts the Supabase ↔ Vercel integration's `NEXT_PUBLIC_SUPABASE_ANON_KEY` when the publishable
 * key isn't set. The value cleaning here is shared with `@/lib/env` so server and browser agree.
 */
export function publicSupabaseEnv(): { url: string; key: string } | null {
  const url = withScheme(cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL));
  const key =
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ?? cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !key) return null;
  return { url, key };
}

/** Trim, drop an unquoted trailing ` # comment`, strip matching quotes; "" → undefined. */
export function cleanEnvValue(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  let s = v.replace(/\s+#.*$/, "").trim();
  if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s.at(-1) === s[0]) s = s.slice(1, -1).trim();
  return s === "" ? undefined : s;
}

/** `abc.supabase.co/` → `https://abc.supabase.co`; an explicit scheme is kept. */
export function withScheme(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const bare = url.replace(/\/+$/, "");
  return /^https?:\/\//i.test(bare) ? bare : `https://${bare}`;
}
