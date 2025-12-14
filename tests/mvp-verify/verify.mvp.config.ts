import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../../vitest.config";

const mvpAuditTests = [
  "src/lib/jobIntent.test.ts",
  "src/lib/agentRunLog.test.ts",
  "src/lib/tenant/diagnostics.test.ts",
  "src/app/api/jobs/[jobReqId]/hm-brief/route.verify.test.ts",
  "src/app/admin/tenant/[tenantId]/operations-runbook/verify.test.tsx",
  "tests/smoke/mvp-smoke.test.ts",
];

const mergedConfig = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: mvpAuditTests,
      pool: "threads",
      minThreads: 1,
      maxThreads: 1,
      sequence: {
        concurrent: false,
      },
      watch: false,
    },
  })
);

mergedConfig.test = {
  ...mergedConfig.test,
  include: mvpAuditTests,
  exclude: [],
};

export default mergedConfig;
