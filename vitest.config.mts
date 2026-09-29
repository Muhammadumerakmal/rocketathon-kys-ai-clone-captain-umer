import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite resolves tsconfig `paths` (@/*) natively.
    tsconfigPaths: true,
    // `server-only` throws outside the react-server condition; tests run plain Node.
    alias: { "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    env: { TWIN_MOCK: "1", OPENAI_AGENTS_DISABLE_TRACING: "1" },
  },
});
