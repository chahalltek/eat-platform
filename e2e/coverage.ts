import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { createCoverageMap, type CoverageMapData } from "istanbul-lib-coverage";
import type { BrowserContext, Page, TestInfo } from "@playwright/test";

const isCoverageEnabled = () => process.env.COVERAGE_E2E === "1";

const sanitize = (value: string) => value.replace(/[^\w.-]+/g, "_");

const testFileName = (testInfo: TestInfo) => {
  const projectPrefix = testInfo.project?.name ? `${sanitize(testInfo.project.name)}-` : "";
  const retrySuffix = testInfo.retry ? `-retry-${testInfo.retry}` : "";
  const repeatSuffix = testInfo.repeatEachIndex ? `-repeat-${testInfo.repeatEachIndex}` : "";

  return `${projectPrefix}${sanitize(testInfo.testId)}${retrySuffix}${repeatSuffix}.json`;
};

const readPageCoverage = async (page: Page) => {
  try {
    return await page.evaluate(() => (window as typeof window & { __coverage__?: CoverageMapData }).__coverage__);
  } catch {
    return undefined;
  }
};

export const persistCoverage = async (context: BrowserContext, testInfo: TestInfo) => {
  if (!isCoverageEnabled()) {
    return;
  }

  const coverageMap = createCoverageMap({});
  const pages = context.pages();

  for (const page of pages) {
    const coverage = await readPageCoverage(page);
    if (!coverage) {
      continue;
    }

    coverageMap.merge(coverage);
  }

  if (coverageMap.files().length === 0) {
    return;
  }

  const outputDir = path.join(process.cwd(), "coverage", "e2e", "raw");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, testFileName(testInfo));

  await writeFile(outputPath, JSON.stringify(coverageMap.toJSON()));
};
