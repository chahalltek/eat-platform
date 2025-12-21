import fs from "node:fs/promises";
import path from "node:path";

import glob from "glob";
import { createCoverageMap, type CoverageMapData } from "istanbul-lib-coverage";
import { createContext } from "istanbul-lib-report";
import reports from "istanbul-reports";

const repoRoot = path.resolve(__dirname, "..");
const mergedDir = path.join(repoRoot, "coverage", "merged");
const unitCoverageCandidates = [
  path.join(repoRoot, "coverage", "unit", "coverage-final.json"),
  path.join(repoRoot, "coverage", "coverage-final.json"), // fallback if unit reportsDirectory not split
];
const e2eCoverageGlob = path.join(repoRoot, "coverage", "e2e", "raw", "**", "*.json");

async function fileExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

// Istanbul coverage keys are file paths. Normalize to forward slashes so merges are stable across OS.
function normalizeCoveragePaths(data: CoverageMapData): CoverageMapData {
  const normalized: CoverageMapData = {};

  for (const [filePath, coverage] of Object.entries(data)) {
    const unixPath = filePath.replace(/\\/g, "/");
    normalized[unixPath] = coverage as any;
  }

  return normalized;
}

async function readCoverageJson(filePath: string): Promise<CoverageMapData> {
  const content = await fs.readFile(filePath, "utf-8");
  return normalizeCoveragePaths(JSON.parse(content) as CoverageMapData);
}

async function loadUnitCoverage() {
  for (const candidate of unitCoverageCandidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  const readablePaths = unitCoverageCandidates.map((candidate) => path.relative(repoRoot, candidate)).join(", ");
  throw new Error(`Unit coverage not found. Looked for: ${readablePaths}. Run "npm run test:coverage:unit" first.`);
}

async function loadE2eCoverageFiles(): Promise<string[]> {
  const files = await glob(e2eCoverageGlob);

  if (files.length === 0) {
    throw new Error(`No E2E coverage files found at ${path.relative(repoRoot, e2eCoverageGlob)}. Run "npm run test:coverage:e2e" first.`);
  }

  return files;
}

async function mergeCoverages(): Promise<void> {
  const mergedMap = createCoverageMap({});

  const unitCoveragePath = await loadUnitCoverage();
  mergedMap.merge(await readCoverageJson(unitCoveragePath));
  console.log(`✅ Added unit coverage from ${path.relative(repoRoot, unitCoveragePath)}`);

  const e2eFiles = await loadE2eCoverageFiles();
  let mergedE2eCount = 0;
  for (const filePath of e2eFiles) {
    const e2eCoverage = await readCoverageJson(filePath);
    mergedMap.merge(e2eCoverage);
    mergedE2eCount++;
    console.log(`✅ Added E2E coverage from ${path.relative(repoRoot, filePath)}`);
  }

  await fs.mkdir(mergedDir, { recursive: true });
  const mergedCoveragePath = path.join(mergedDir, "coverage-final.json");
  await fs.writeFile(mergedCoveragePath, JSON.stringify(mergedMap.toJSON(), null, 2));

  const context = createContext({ dir: mergedDir, coverageMap: mergedMap });
  const html = reports.create("html", {});
  const lcov = reports.create("lcovonly", { file: "lcov.info" });
  const textSummary = reports.create("text-summary", {});

  html.execute(context);
  lcov.execute(context);
  textSummary.execute(context);

  console.log(`📦 Merged coverage written to ${path.relative(repoRoot, mergedCoveragePath)}`);
  console.log(`   E2E files merged: ${mergedE2eCount}`);
}

mergeCoverages().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
