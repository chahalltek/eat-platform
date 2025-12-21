import { test as base } from "@playwright/test";

import { collectIstanbulCoverage, writeCoverageFile } from "./_utils/coverage";

export const test = base;
export const expect = test.expect;

test.afterEach(async ({ context }, testInfo) => {
  if (process.env.COVERAGE_E2E !== "1") {
    return;
  }

  const coverageEntries = await collectIstanbulCoverage(context.pages());
  const mergedCoverage = Object.assign({}, ...coverageEntries);

  await writeCoverageFile(testInfo, mergedCoverage);
});
