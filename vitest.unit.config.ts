import { configDefaults, defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      exclude: [
        ...configDefaults.exclude,
        "tests/agents/**",
        "**/*.contract.spec.ts",
        "**/*.bdd.spec.ts",
        "src/app/**/*.{test,spec}.{ts,tsx}",
        "src/components/**/*.{test,spec}.{ts,tsx}",
        "src/lib/agents/**",
        "src/lib/admin/**",
        "src/lib/guardrails/**",
        "src/lib/matching/**",
        "src/lib/prisma.test.ts",
        "src/lib/subscriptionPlans.test.ts",
        "src/app/api/**/route.test.ts",
      ],
      coverage: {
        reportsDirectory: "./coverage/unit",
      },
    },
  })
);
