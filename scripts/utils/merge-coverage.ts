import fs from "node:fs";
import path from "node:path";
import { createCoverageMap, type CoverageMapData } from "istanbul-lib-coverage";
import { createContext } from "istanbul-lib-report";
import reports from "istanbul-reports";

const COVERAGE_ROOT = path.resolve(process.cwd(), "coverage");
const MERGED_DIR = path.join(COVERAGE_ROOT, "merged");

function collectCoverageFiles(startDir: string): string[] {
  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(startDir, entry.name);

    if (fullPath === MERGED_DIR) {
      return [];
    }

    if (entry.isDirectory()) {
      return collectCoverageFiles(fullPath);
    }

    return entry.name === "coverage-final.json" ? [fullPath] : [];
  });
}

function readCoverageFiles(coverageFiles: string[]) {
  const coverageMap = createCoverageMap({});

  coverageFiles.forEach((filePath) => {
    const contents = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(contents) as CoverageMapData;
    coverageMap.merge(parsed);
  });

  return coverageMap;
}

function prepareMergedDirectory() {
  fs.rmSync(MERGED_DIR, { recursive: true, force: true });
  fs.mkdirSync(MERGED_DIR, { recursive: true });
}

function writeReports() {
  if (!fs.existsSync(COVERAGE_ROOT)) {
    throw new Error(`Coverage root not found at ${COVERAGE_ROOT}`);
  }

  const discoveredFiles = collectCoverageFiles(COVERAGE_ROOT);

  if (discoveredFiles.length === 0) {
    throw new Error("No coverage-final.json files found to merge.");
  }

  const coverageMap = readCoverageFiles(discoveredFiles);
  const context = createContext({ dir: MERGED_DIR, coverageMap });
  const reporters = ["json", "json-summary", "lcov", "html"] as const;

  prepareMergedDirectory();

  reporters.forEach((reporter) => {
    reports.create(reporter).execute(context);
  });

  console.log(
    `Merged ${discoveredFiles.length} coverage entr${discoveredFiles.length === 1 ? "y" : "ies"} into ${path.relative(
      process.cwd(),
      MERGED_DIR
    )}`
  );
}

writeReports();
