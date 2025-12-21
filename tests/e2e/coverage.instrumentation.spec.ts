import { expect, test } from "@playwright/test";

test.describe("coverage instrumentation", () => {
  test.skip(process.env.COVERAGE_E2E !== "1", "Coverage instrumentation disabled");

  test("exposes window.__coverage__", async ({ page }) => {
    await page.goto("/");

    const hasCoverage = await page.evaluate(() => Boolean((window as any).__coverage__));

    expect(hasCoverage).toBe(true);
  });
});
