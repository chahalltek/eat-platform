<<<<<<< ours
import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
=======
import fs from "node:fs/promises";
import path from "node:path";

import glob from "glob";
>>>>>>> theirs
import { createCoverageMap, type CoverageMapData } from "istanbul-lib-coverage";
import { createContext } from "istanbul-lib-report";
import reports from "istanbul-reports";

<<<<<<< ours
const UNIT_COVERAGE_CANDIDATES = [
  "coverage/unit/coverage-final.json",
  "coverage/coverage-final.json", // fallback if unit reportsDirectory not split
];

const E2E_GLOB = "coverage/e2e/raw/**/*.json";
const OUT_DIR = "coverage/merged";

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

// Istanbul coverage keys are file paths. Normalize to forward slashes so merges are stable across OS.
function normalizeCoveragePaths(data: CoverageMapData): CoverageMapData {
  const normalized: CoverageMapData = {};
  for (const [k, v] of Object.entries(data)) {
    const nk = k.replace(/\\\\/g, "/");
    normalized[nk] = v as any;
=======
const repoRoot = path.resolve(__dirname, "..");
const mergedDir = path.join(repoRoot, "coverage", "merged");
const unitCoverageCandidates = [
  path.join(repoRoot, "coverage", "unit", "coverage-final.json"),
  path.join(repoRoot, "coverage", "coverage-final.json"),
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

function normalizeCoveragePaths(data: CoverageMapData): CoverageMapData {
  const normalized: CoverageMapData = {};

  for (const [filePath, coverage] of Object.entries(data)) {
    const unixPath = filePath.replace(/\\/g, "/");
    normalized[unixPath] = coverage;
>>>>>>> theirs
  }
  return normalized;
}

<<<<<<< ours
function findFirstExisting(pathsToTry: string[]): string | null {
  for (const p of pathsToTry) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}
=======
async function readCoverageJson(filePath: string): Promise<CoverageMapData> {
  const content = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(content) as CoverageMapData;
  return normalizeCoveragePaths(parsed);
}

async function loadUnitCoverage() {
  for (const candidate of unitCoverageCandidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  const readablePaths = unitCoverageCandidates.map((candidate) => path.relative(repoRoot, candidate)).join(", ");
  throw new Error(`Unit coverage not found. Looked for: ${readablePaths}. Run "npm run coverage:unit" first.`);
}

async function loadE2eCoverageFiles(): Promise<string[]> {
  const files = await glob(e2eCoverageGlob);
>>>>>>> theirs

function main() {
  const unitPath = findFirstExisting(UNIT_COVERAGE_CANDIDATES);
  if (!unitPath) {
    throw new Error(
<<<<<<< ours
      `Unit coverage not found. Expected one of:\n- ${UNIT_COVERAGE_CANDIDATES.join(
        "\n- "
      )}\n\nRun unit coverage first (Vitest + istanbul), e.g.:\n  npm run test:coverage:unit`
    );
  }

  const e2eFiles = fg.sync(E2E_GLOB, { onlyFiles: true, unique: true });
  if (e2eFiles.length === 0) {
    throw new Error(
      `E2E coverage files not found at "${E2E_GLOB}".\n\nRun E2E with instrumentation + collection, e.g.:\n  COVERAGE_E2E=1 BABEL_ENV=coverage_e2e npm run test:e2e`
    );
  }

  const unitRaw = readJson(unitPath) as CoverageMapData;
  const map = createCoverageMap({});

  map.merge(normalizeCoveragePaths(unitRaw));

  let mergedE2ECount = 0;
  for (const f of e2eFiles) {
    try {
      const raw = readJson(f) as CoverageMapData;
      map.merge(normalizeCoveragePaths(raw));
      mergedE2ECount++;
    } catch (err) {
      // Don’t silently ignore malformed coverage; fail with which file is bad.
      throw new Error(`Failed to parse/merge E2E coverage file: ${f}\n${String(err)}`);
    }
  }

  ensureDir(OUT_DIR);

  // Write merged JSON
  const mergedJsonPath = path.join(OUT_DIR, "coverage-final.json");
  fs.writeFileSync(mergedJsonPath, JSON.stringify(map.toJSON()), "utf8");

  // Generate reports
  const context = createContext({
    dir: OUT_DIR,
    coverageMap: map,
  });

  const html = reports.create("html", {});
  const lcov = reports.create("lcovonly", { file: "lcov.info" });
  const textSummary = reports.create("text-summary", {});

  html.execute(context);
  lcov.execute(context);
  textSummary.execute(context);

  // Friendly output
  // eslint-disable-next-line no-console
  console.log(`\n✅ Merged coverage written to: ${OUT_DIR}`);
  // eslint-disable-next-line no-console
  console.log(`   Unit file: ${unitPath}`);
  // eslint-disable-next-line no-console
  console.log(`   E2E files merged: ${mergedE2ECount}`);
  // eslint-disable-next-line no-console
  console.log(`   HTML report: ${path.join(OUT_DIR, "index.html")}`);
  // eslint-disable-next-line no-console
  console.log(`   LCOV report: ${path.join(OUT_DIR, "lcov.info")}`);
}

main();
=======
      `No E2E coverage files found at ${path.relative(repoRoot, e2eCoverageGlob)}. Run "npm run test:coverage:e2e" first.`,
    );
  }

  return files;
}

async function mergeCoverages(): Promise<void> {
  const mergedMap = createCoverageMap({});

  const unitCoveragePath = await loadUnitCoverage();
  const unitCoverage = await readCoverageJson(unitCoveragePath);
  mergedMap.merge(unitCoverage);
  console.log(`✅ Added unit coverage from ${path.relative(repoRoot, unitCoveragePath)}`);

  const e2eFiles = await loadE2eCoverageFiles();
  for (const filePath of e2eFiles) {
    const e2eCoverage = await readCoverageJson(filePath);
    mergedMap.merge(e2eCoverage);
    console.log(`✅ Added E2E coverage from ${path.relative(repoRoot, filePath)}`);
  }

  await fs.mkdir(mergedDir, { recursive: true });
  const mergedCoveragePath = path.join(mergedDir, "coverage-final.json");
  await fs.writeFile(mergedCoveragePath, JSON.stringify(mergedMap.toJSON(), null, 2));

  const context = createContext({ dir: mergedDir, coverageMap: mergedMap });
  const reporters = ["json-summary", "lcov", "html", "text-summary"] as const;
  for (const reporter of reporters) {
    reports.create(reporter).execute(context);
  }

  console.log(`📦 Merged coverage written to ${path.relative(repoRoot, mergedDir)}`);
}

mergeCoverages().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
>>>>>>> theirs
