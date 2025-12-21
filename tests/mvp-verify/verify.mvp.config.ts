import type { UserConfig } from "vite";
import { defineConfig } from "vitest/config";
import baseConfig from "../../vitest.config";

const mvpAuditTests = [
  "src/lib/jobIntent.test.ts",
  "src/lib/agentRunLog.test.ts",
  "src/lib/tenant/diagnostics.test.ts",
  "src/app/api/jobs/[jobReqId]/hm-brief/route.verify.test.ts",
  "src/app/api/upload/resume/route.test.ts",
  "src/app/admin/tenant/[tenantId]/operations-runbook/verify.test.tsx",
  "tests/smoke/mvp-smoke.test.ts",
];

const base = baseConfig as UserConfig;

const testConfig = {
  ...(base.test ?? {}),
  include: mvpAuditTests,
  pool: "threads",
  minThreads: 1,
  maxThreads: 1,
  sequence: {
    concurrent: false,
  },
  watch: false,
  exclude: [],
};

export default defineConfig({
  ...base,
  test: testConfig,
});
