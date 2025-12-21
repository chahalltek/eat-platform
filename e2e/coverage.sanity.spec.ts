import { expect, test } from "@playwright/test";

const shouldCheckCoverage = process.env.COVERAGE_E2E === "1";

test.describe("Coverage instrumentation", () => {
  test.skip(!shouldCheckCoverage, "E2E coverage sanity check disabled");

  test("captures coverage on login page navigation", async ({ page }) => {
    await page.goto("/login");

    const coverageStatus = await page.evaluate(() => {
      const coverage = (window as any).__coverage__;

      if (!coverage) {
        return { hasCoverage: false, hasSrcEntry: false };
      }

      const coverageKeys = Object.keys(coverage);
      return {
        hasCoverage: Boolean(coverage),
        hasSrcEntry: coverageKeys.some((key) => key.includes("src/")),
      };
    });

    expect(coverageStatus.hasCoverage).toBe(true);
    expect(coverageStatus.hasSrcEntry).toBe(true);
  });
});
