import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Live-model evals (plan §13). Needs real keys; never part of `npm run check`.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    testTimeout: 180_000,
  },
});
