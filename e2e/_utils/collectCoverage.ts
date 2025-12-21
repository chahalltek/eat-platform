import fs from "node:fs";
import path from "node:path";

import type { Browser, Page, TestInfo } from "@playwright/test";

type CoverageMap = Record<string, unknown>;

const COVERAGE_FLAG = "1";

function sanitizeFilenamePart(value: string) {
  return value.replace(/[\\/]/g, "-").replace(/\s+/g, "-");
}

async function readCoverageFromPage(page: Page) {
  if (page.isClosed()) return null;

  try {
    return await page.evaluate(() => (window as any).__coverage__ || null);
  } catch (error) {
    console.warn(`[coverage] Unable to read coverage from ${page.url()}:`, error);
    return null;
  }
}

export async function collectCoverage({ browser, testInfo }: { browser: Browser; testInfo: TestInfo }) {
  if (process.env.COVERAGE_E2E !== COVERAGE_FLAG) return;

  try {
    const pages = browser.contexts().flatMap((context) => context.pages());

    const coverageEntries = await Promise.all(pages.map(readCoverageFromPage));
    const merged = coverageEntries.reduce<CoverageMap>((acc, entry) => (entry ? { ...acc, ...entry } : acc), {});

    const titlePath = testInfo.titlePath.join(" > ");

    if (Object.keys(merged).length === 0) {
      console.warn(`[coverage] No coverage found for ${titlePath}.`);
      return;
    }

    const outputDir = path.join(process.cwd(), "coverage", "e2e", "raw");
    fs.mkdirSync(outputDir, { recursive: true });

    const filename = `${sanitizeFilenamePart(testInfo.project.name)}-${sanitizeFilenamePart(titlePath)}-${Date.now()}.json`;
    fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(merged));
  } catch (error) {
    console.warn(`[coverage] Failed to write coverage for ${testInfo.title}:`, error);
  }
}
