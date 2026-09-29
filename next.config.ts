import path from "node:path";
import type { NextConfig } from "next";
import { cleanEnvValue, withScheme } from "./src/lib/supabase/public-env";

const isDev = process.env.NODE_ENV !== "production";
// Same cleaning as the browser client, so the CSP allows exactly the origin it connects to.
const supabaseUrl = withScheme(cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL)) ?? "";

// Plan §10: CSP, X-Frame-Options DENY, no framing, no sniffing.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} ${supabaseUrl.replace(/^http/, "ws")} https://api.openai.com`.trim(),
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Pin the workspace root: a stray lockfile higher up the tree must not be picked instead.
  turbopack: { root: path.resolve(".") },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
