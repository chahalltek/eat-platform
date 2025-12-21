import fs from "node:fs";
import path from "node:path";
import { config as loadEnvConfig } from "dotenv";
import { defineConfig } from "vitest/config";
import { coverageThresholds } from "./vitest.coverage.thresholds";

const coverageDir = process.env.COVERAGE_DIR ?? "./coverage";
const envFilePath = path.resolve(__dirname, process.env.VITEST_ENV_FILE ?? ".env.test");
const coverageDirectory = path.resolve(__dirname, process.env.COVERAGE_DIR ?? "coverage");

if (fs.existsSync(envFilePath)) {
  loadEnvConfig({ path: envFilePath });
}

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts", "./vitest.setup.ts", "./tests/vitest.setup.ts"],
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules/**",
      "e2e/**",
      "tests/admin-layout/**", // Playwright E2E suite runs via its own runner
      "tests/visual/**", // Playwright visual tests run via their own runner
      "tests/e2e/**",
    ],
    coverage: {
<<<<<<< ours
      provider: "istanbul",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "coverage/unit",
=======
      provider: "v8",
      reporter: ["text", "json", "json-summary", "lcov", "html"],
<<<<<<< ours
      reportsDirectory: coverageDir,
>>>>>>> theirs
=======
      reportsDirectory: coverageDirectory,
>>>>>>> theirs
      reportOnFailure: true,
      include: [
        "src/lib/**/*.{ts,tsx}",
        "src/server/**/*.{ts,tsx}",
        "src/app/**/*.{ts,tsx}",
        "src/components/**/*.{ts,tsx}",
      ],
      exclude: [
        "src/**/__mocks__/**",
        "**/__generated__/**",
        "src/**/types/**",
        "src/app/**/page.tsx", // Route entrypoints validated through Playwright E2E coverage
      ],
      thresholds: coverageThresholds,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
      "server-only": path.resolve(__dirname, "./server-only.ts"),
    },
  },
});
