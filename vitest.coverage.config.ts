import path from "node:path";
import type { UserConfig } from "vite";
import { mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";
import { coverageThresholds } from "./vitest.coverage.thresholds";

const reportsDirectory = path.resolve(__dirname, process.env.COVERAGE_DIR ?? "coverage");

const coverageOverrides: UserConfig = {
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "lcov", "html"],
      reportsDirectory,
      reportOnFailure: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/__mocks__/**",
        "**/__generated__/**",
        "src/**/types/**",
        "src/app/**/page.tsx", // Route entrypoints validated through Playwright E2E coverage
      ],
      thresholds: coverageThresholds,
    },
  },
};

export default mergeConfig(baseConfig, coverageOverrides);
