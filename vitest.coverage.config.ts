import type { UserConfig } from "vite";
import { mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";
import { coverageThresholds } from "./vitest.coverage.thresholds";

const coverageOverrides: UserConfig = {
  test: {
    environment: "node",
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "coverage/unit",
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
