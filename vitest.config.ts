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
    setupFiles: ["./tests/setup/prisma.mock.ts", "./vitest.setup.ts", "./tests/vitest.setup.ts"],
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov", "html"],
      reportsDirectory: "./coverage",
      exclude: [],
      include: ["src/coverageTarget.ts"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
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
