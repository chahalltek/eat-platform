import { expect, test } from "@playwright/test";

const shouldSkip = process.env.COVERAGE_E2E !== "1";

test.describe("Coverage instrumentation", () => {
  test.skip(shouldSkip, 'Set COVERAGE_E2E="1" to run coverage sanity checks');

  test("captures coverage on login page navigation", async ({ page }) => {
    await page.goto("/login");

    const coverageHandle = await page.waitForFunction(() => {
      const coverageData = (window as typeof window & { __coverage__?: Record<string, unknown> }).__coverage__;
      if (!coverageData) return null;

      const keys = Object.keys(coverageData);
      if (keys.length === 0) return null;

      return { keys };
    });

    const coverageData = (await coverageHandle.jsonValue()) as { keys: string[] };

    expect(coverageData.keys.length).toBeGreaterThan(0);
    expect(coverageData.keys.some((key) => key.includes("src/"))).toBe(true);
  });
});
