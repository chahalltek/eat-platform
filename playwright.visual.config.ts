import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/visual",
  outputDir: "test-results/visual/artifacts",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    headless: true,
  },
  reporter: [["list"], ["html", { outputFolder: "test-results/visual/html-report", open: "never" }]],
  projects: [
    {
      name: "light",
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "light",
      },
    },
    {
      name: "dark",
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "dark",
      },
    },
  ],
});
