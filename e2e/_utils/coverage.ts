import fs from "node:fs";
import path from "node:path";

import type { Page, TestInfo } from "@playwright/test";

export type IstanbulCoverage = Record<string, unknown>;

export async function collectIstanbulCoverage(pages: Page[]): Promise<IstanbulCoverage[]> {
  const coverage: IstanbulCoverage[] = [];

  for (const page of pages) {
    if (page.isClosed()) {
      continue;
    }

    try {
      const pageCoverage = await page.evaluate(() => (window as unknown as { __coverage__?: IstanbulCoverage }).__coverage__);
      if (pageCoverage) {
        coverage.push(pageCoverage);
      }
    } catch (error) {
      console.warn("Failed to collect coverage from page", error);
    }
  }

  return coverage;
}

function sanitizeForFilename(value: string): string {
  const sanitized = value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return sanitized || "test";
}

export async function writeCoverageFile(testInfo: TestInfo, coverage: IstanbulCoverage): Promise<void> {
  const rawOutputDir = path.join("coverage", "e2e", "raw");
  fs.mkdirSync(rawOutputDir, { recursive: true });

  const projectName = sanitizeForFilename(testInfo.project.name);
  const titlePath = sanitizeForFilename(testInfo.titlePath.join("-"));
  const retrySuffix = String(testInfo.retry ?? 0);

  const fileName = `${projectName}-${titlePath}-${retrySuffix}.json`;
  const filePath = path.join(rawOutputDir, fileName);

  fs.writeFileSync(filePath, JSON.stringify(coverage));
}
