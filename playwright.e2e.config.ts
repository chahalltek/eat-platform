import { defineConfig, devices } from "@playwright/test";

import { AUTH_SETUP_PROJECT, AUTH_STORAGE_STATE, E2E_AUTH_SETUP_TEST_MATCH } from "./tests/playwrightAuth";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const defaultHeaders = {
  "x-eat-user-id": process.env.E2E_USER_ID ?? "routes-smoke-user",
  "x-eat-user-role": process.env.E2E_USER_ROLE ?? "ADMIN",
  "x-eat-tenant-id": process.env.E2E_TENANT_ID ?? "routes-smoke-tenant",
};

export default defineConfig({
  testDir: ".",
  testMatch: ["tests/e2e/**/*.spec.ts", "e2e/auth.setup.ts"],
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
      name: AUTH_SETUP_PROJECT,
      testMatch: E2E_AUTH_SETUP_TEST_MATCH,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "chromium",
      testIgnore: E2E_AUTH_SETUP_TEST_MATCH,
      testMatch: "tests/e2e/**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "chromium-auth",
      testMatch: "**/routes.auth.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_STORAGE_STATE,
      },
      dependencies: [AUTH_SETUP_PROJECT],
    },
  ],
});
