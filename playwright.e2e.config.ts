import { defineConfig, devices } from "@playwright/test";

import { AUTH_SETUP_PROJECT, AUTH_STORAGE_STATE, E2E_AUTH_SETUP_TEST_MATCH } from "./tests/playwrightAuth";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
=======
const shouldStartLocalServer = !process.env.E2E_BASE_URL;
const coverageEnabled = process.env.COVERAGE_E2E === "1";
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
const defaultHeaders = {
  "x-eat-user-id": process.env.E2E_USER_ID ?? "routes-smoke-user",
  "x-eat-user-role": process.env.E2E_USER_ROLE ?? "ADMIN",
  "x-eat-tenant-id": process.env.E2E_TENANT_ID ?? "routes-smoke-tenant",
};
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
=======
const coverageEnabled = process.env.COVERAGE_E2E === "1";
const coverageEnv = coverageEnabled ? { COVERAGE_E2E: "1" } : undefined;
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs

export default defineConfig({
  testDir: ".",
  testMatch: ["tests/e2e/**/*.spec.ts", "e2e/auth.setup.ts"],
  outputDir: "test-results/e2e/artifacts",
  timeout: 60_000,
  fullyParallel: true,
  expect: {
    timeout: 10_000,
  },
  metadata: {
    coverageEnabled,
  },
  use: {
    baseURL,
    extraHTTPHeaders: defaultHeaders,
    trace: "retain-on-failure",
    headless: true,
    launchOptions: coverageEnv ? { env: { ...process.env, ...coverageEnv } } : undefined,
  },
  reporter: [["list"], ["html", { outputFolder: "test-results/e2e/html-report", open: "never" }]],
  webServer: shouldStartLocalServer
    ? {
        command: "npm run dev -- --port 3000",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: coverageEnabled
          ? {
              ...process.env,
              BABEL_ENV: "coverage_e2e",
              COVERAGE_E2E: "1",
            }
          : undefined,
      }
    : undefined,
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
