import { expect, test } from "@playwright/test";

<<<<<<< ours
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
=======
const shouldSkip = process.env.COVERAGE_E2E !== "1";

test.skip(shouldSkip, 'Set COVERAGE_E2E="1" to run coverage sanity checks');

test.describe("Coverage instrumentation sanity", () => {
  test("asserts coverage object is present", async ({ page }) => {
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
    expect(coverageData.keys.some((key) => key.includes("src/app/"))).toBe(true);
>>>>>>> theirs
  });
});
