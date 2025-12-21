import { defineConfig, devices } from "@playwright/test";

import { AUTH_SETUP_PROJECT, AUTH_SETUP_TEST_MATCH, AUTH_STORAGE_STATE } from "./tests/playwrightAuth";

const baseURL = process.env.ADMIN_SWEEP_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results/admin-layout/artifacts",
  timeout: 120_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    headless: true,
  },
  reporter: [["list"], ["html", { outputFolder: "test-results/admin-layout/html-report", open: "never" }]],
  projects: [
    {
      name: AUTH_SETUP_PROJECT,
      testMatch: AUTH_SETUP_TEST_MATCH,
    },
    {
      name: "chromium",
      testMatch: "admin-layout/**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_STORAGE_STATE,
      },
      dependencies: [AUTH_SETUP_PROJECT],
    },
  ],
});
