import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const defaultHeaders = {
  "x-eat-user-id": process.env.E2E_USER_ID ?? "routes-smoke-user",
  "x-eat-user-role": process.env.E2E_USER_ROLE ?? "ADMIN",
  "x-eat-tenant-id": process.env.E2E_TENANT_ID ?? "routes-smoke-tenant",
};

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/e2e/artifacts",
  timeout: 60_000,
  fullyParallel: true,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    extraHTTPHeaders: defaultHeaders,
    trace: "retain-on-failure",
    headless: true,
  },
  reporter: [["list"], ["html", { outputFolder: "test-results/e2e/html-report", open: "never" }]],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
