import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Live-model evals (plan §13). Needs OPENAI_API_KEY in .env.local; never part of `npm run check`.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    testTimeout: 180_000,
    hookTimeout: 60_000,
    // Evals call agents directly (no DB, no routes), so TWIN_MOCK only relaxes the
    // Supabase env requirement here; the model calls are real.
    env: { ...loadEnv("", process.cwd(), ""), TWIN_MOCK: "1", OPENAI_AGENTS_DISABLE_TRACING: "1" },
  },
});
