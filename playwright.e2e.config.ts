import path from "node:path";
import { defineCoverageReporterConfig } from "@bgotink/playwright-coverage";
import { defineConfig, devices, type ReporterDescription } from "@playwright/test";

import { AUTH_SETUP_PROJECT, AUTH_STORAGE_STATE, E2E_AUTH_SETUP_TEST_MATCH } from "./tests/playwrightAuth";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
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
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
const shouldStartLocalServer = !process.env.E2E_BASE_URL;

const shouldEnableCoverage = process.env.COVERAGE_E2E === "1" || shouldStartLocalServer;

if (shouldEnableCoverage && !process.env.COVERAGE_E2E) {
  process.env.COVERAGE_E2E = "1";
}

if (shouldEnableCoverage && !process.env.BABEL_ENV) {
  process.env.BABEL_ENV = "coverage_e2e";
}

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
=======

const enableCoverage = process.env.PLAYWRIGHT_COVERAGE === "1";
const coverageDir = path.resolve(__dirname, process.env.COVERAGE_DIR ?? "coverage/e2e");

const reporter: ReporterDescription[] = [
  ["list"],
  ["html", { outputFolder: "test-results/e2e/html-report", open: "never" }],
];

if (enableCoverage) {
  reporter.push([
    "@bgotink/playwright-coverage",
    defineCoverageReporterConfig({
      sourceRoot: __dirname,
      resultDir: coverageDir,
      reports: [
        ["json", { file: "coverage-final.json" }],
        ["json-summary", { file: "coverage-summary.json" }],
        ["lcovonly", { file: "lcov.info" }],
        ["html"],
        ["text-summary", { file: null }],
      ],
    }),
  ]);
}
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
<<<<<<< ours
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
=======
  reporter,
>>>>>>> theirs
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
  webServer: shouldStartLocalServer
    ? {
        command: "npm run dev -- --port 3000",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          COVERAGE_E2E: shouldEnableCoverage ? "1" : undefined,
          BABEL_ENV: shouldEnableCoverage ? "coverage_e2e" : undefined,
        },
      }
    : undefined,
});
