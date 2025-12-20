import fs from "node:fs";
import path from "node:path";
import { config as loadEnvConfig } from "dotenv";
import { defineConfig } from "vitest/config";

const envFilePath = path.resolve(__dirname, process.env.VITEST_ENV_FILE ?? ".env.test");

if (fs.existsSync(envFilePath)) {
  loadEnvConfig({ path: envFilePath });
}

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [
      ["src/app/api/**", "node"],
      ["src/server/**", "node"],
    ],
    setupFiles: ["./tests/setup.ts", "./vitest.setup.ts", "./tests/vitest.setup.ts"],
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules/**",
      "tests/admin-layout/**", // Playwright E2E suite runs via its own runner
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "lcov", "html"],
      reportsDirectory: "./coverage",
      all: true,
      reportOnFailure: true,
      include: [
        "src/lib/**/*.{ts,tsx}",
        "src/server/**/*.{ts,tsx}",
        "src/app/**/*.{ts,tsx}",
        "src/components/**/*.{ts,tsx}",
      ],
      exclude: ["src/**/__mocks__/**", "**/__generated__/**", "src/**/types/**"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
        perFile: true,
        "src/lib/**": {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
        "src/server/**": {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
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
