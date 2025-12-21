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
      provider: "istanbul",
      reporter: ["text", "json", "html", "lcov"],
<<<<<<< ours
<<<<<<< ours
      reportsDirectory: "coverage/unit",
=======
      reportsDirectory: process.env.COVERAGE_DIR ?? "./coverage",
>>>>>>> theirs
=======
      reportsDirectory,
>>>>>>> theirs
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
