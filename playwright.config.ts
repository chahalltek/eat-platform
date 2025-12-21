import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const coverageEnabled = process.env.COVERAGE_E2E === "1";
const shouldStartLocalServer = !process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  metadata: {
    coverageEnabled,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    headless: true,
  },
  webServer: shouldStartLocalServer
    ? {
        command: coverageEnabled ? "npm run dev:coverage -- --port 3000" : "npm run dev -- --port 3000",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
