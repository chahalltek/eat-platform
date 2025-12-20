import type { UserConfig } from "vite";
import { mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

const coverageOverrides: UserConfig = {
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov", "html"],
      reportsDirectory: "./coverage",
      all: true,
      include: ["src/**/*.{ts,tsx}"],
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
};

export default mergeConfig(baseConfig, coverageOverrides);
