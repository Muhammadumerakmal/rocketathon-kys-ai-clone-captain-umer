import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Live-model evals (plan §13). Needs real keys; never part of `npm run check`.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    testTimeout: 180_000,
  },
});
