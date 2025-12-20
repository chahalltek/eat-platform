import type { UserConfig } from "vite";
import { mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

const coverageOverrides: UserConfig = {
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["src/app/api/**", "node"],
      ["src/server/**", "node"],
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      all: true,
<<<<<<< ours
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
=======
      reportOnFailure: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/__mocks__/**", "**/__generated__/**", "src/**/types/**"],
>>>>>>> theirs
    },
  },
};

export default mergeConfig(baseConfig, coverageOverrides);
