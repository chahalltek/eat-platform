import { expect, test as base } from "@playwright/test";
import { persistCoverage } from "../../e2e/coverage";

export { expect };
export { type Locator, type Page } from "@playwright/test";

export const test = base;

test.afterEach(async ({ context }, testInfo) => {
  await persistCoverage(context, testInfo);
});
