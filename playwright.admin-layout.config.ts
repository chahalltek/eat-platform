import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.ADMIN_SWEEP_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/admin-layout",
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
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
