<<<<<<< ours
import { expect, test as base } from "@playwright/test";
import { persistCoverage } from "../../e2e/coverage";

export { expect };
export { type Locator, type Page } from "@playwright/test";

export const test = base;

test.afterEach(async ({ context }, testInfo) => {
  await persistCoverage(context, testInfo);
});
=======
import fs from "node:fs/promises";
import path from "node:path";

import { createCoverageMap, type CoverageMapData } from "istanbul-lib-coverage";
import { test as base } from "@playwright/test";

const coverageEnabled = process.env.COVERAGE_E2E === "1";
const coverageOutputDir = path.join(process.cwd(), "coverage", "e2e", "raw");

const sanitizeTitle = (titlePath: string[]) => {
  const joinedTitle = titlePath.join(" ");
  const sanitized = joinedTitle.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "test";
};

export const test = base.extend<{ _coverageCollector: void }>({
  _coverageCollector: [
    async ({ browser, context: _context }, use, testInfo) => {
      await use();

      if (!coverageEnabled) {
        return;
      }

      const contexts = browser.contexts();
      if (!contexts.length) {
        return;
      }

      const coverageMap = createCoverageMap({});

      for (const activeContext of contexts) {
        for (const page of activeContext.pages()) {
          if (page.isClosed()) {
            continue;
          }

          const coverage = await page
            .evaluate(() => (window as unknown as { __coverage__?: CoverageMapData }).__coverage__)
            .catch(() => undefined);

          if (coverage) {
            coverageMap.merge(coverage);
          }
        }
      }

      const mergedCoverage = coverageMap.toJSON();
      if (!Object.keys(mergedCoverage).length) {
        return;
      }

      const fileName = `${sanitizeTitle(testInfo.titlePath())}-${Date.now()}.json`;
      const filePath = path.join(coverageOutputDir, fileName);

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(mergedCoverage), "utf-8");
    },
    { auto: true },
  ],
});

export const expect = test.expect;
>>>>>>> theirs
