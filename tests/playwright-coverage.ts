import { expect as baseExpect, test as base } from "@playwright/test";

import { collectCoverage } from "../e2e/_utils/collectCoverage";

const test = base;
const expect = baseExpect;

test.afterEach(async ({ browser }, testInfo) => {
  await collectCoverage({ browser, testInfo });
});

export { expect, test };
export type { Browser, BrowserContext, Locator, Page } from "@playwright/test";
