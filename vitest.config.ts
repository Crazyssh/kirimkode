import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest configuration for the KirimKode test suite.
// - Node environment (service layer under src/lib/** is server-side only).
// - Resolves the "@/..." path alias to src/ (mirrors tsconfig.json).
// - Loads environment variables (DATABASE_URL, EMAIL_*) via the setup file.
// Run once (not watch) via `npm test` -> `vitest --run`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Property-based tests (fast-check, >=100 iterations) plus DB round-trips
    // can exceed the default 5s per-test budget.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ["src/**/*.{test,spec}.ts"],
  },
});
