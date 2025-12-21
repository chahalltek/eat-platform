<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
import fs from "node:fs";
import path from "node:path";
=======
import { promises as fs } from "fs";
import path from "path";
import { glob } from "glob";
>>>>>>> theirs
import { createCoverageMap, type CoverageMapData } from "istanbul-lib-coverage";
import { createContext } from "istanbul-lib-report";
import reports from "istanbul-reports";

<<<<<<< ours
type CoverageSource = {
  label: string;
  path: string;
};

const repoRoot = path.resolve(__dirname, "..");
const coverageRoot = path.join(repoRoot, "coverage");
const mergedDir = path.join(coverageRoot, "merged");

type LoadedCoverage = CoverageSource & {
  map: ReturnType<typeof createCoverageMap>;
};

const coverageSources: CoverageSource[] = [
  { label: "unit", path: path.join(coverageRoot, "unit", "coverage-final.json") },
  { label: "e2e", path: path.join(coverageRoot, "e2e", "coverage-final.json") },
];

const fallbackCoveragePath = path.join(coverageRoot, "coverage-final.json");
const hasDedicatedCoverage = coverageSources.some((source) => fs.existsSync(source.path));
if (!hasDedicatedCoverage && fs.existsSync(fallbackCoveragePath)) {
  coverageSources.push({ label: "default", path: fallbackCoveragePath });
}

function loadCoverage(source: CoverageSource) {
  if (!fs.existsSync(source.path)) {
    console.warn(`⚠️ Skipping ${source.label} coverage: ${path.relative(repoRoot, source.path)} not found.`);
    return undefined;
  }

  const raw = fs.readFileSync(source.path, "utf8");
  try {
    const data = JSON.parse(raw) as CoverageMapData;
    return createCoverageMap(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse coverage for ${source.label}: ${message}`);
  }
}

function generateReports(coverageMap: ReturnType<typeof createCoverageMap>) {
  fs.mkdirSync(mergedDir, { recursive: true });
  const mergedPath = path.join(mergedDir, "coverage-final.json");
  fs.writeFileSync(mergedPath, JSON.stringify(coverageMap.toJSON(), null, 2));

  const context = createContext({ dir: mergedDir, coverageMap });
  const reporters = ["json-summary", "lcov", "html", "text-summary"] as const;

  for (const reporter of reporters) {
    reports.create(reporter).execute(context);
  }

  console.log(`📦 Merged coverage written to ${path.relative(repoRoot, mergedDir)}`);
}

function main() {
  const loadedMaps = coverageSources
    .map((source) => {
      const map = loadCoverage(source);
      return map ? { ...source, map } : undefined;
    })
    .filter((entry): entry is LoadedCoverage => Boolean(entry));

  if (loadedMaps.length === 0) {
    throw new Error("No coverage artifacts found. Run the unit and E2E coverage tasks before merging.");
  }

  const mergedMap = createCoverageMap({});
  for (const { label, map, path: sourcePath } of loadedMaps) {
    console.log(`✅ Added ${label} coverage from ${path.relative(repoRoot, sourcePath)}`);
    mergedMap.merge(map);
  }

  generateReports(mergedMap);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
=======
import fs from "node:fs/promises";
import path from "node:path";
import { createCoverageMap, type CoverageMapData } from "istanbul-lib-coverage";
import { createContext, summarizers } from "istanbul-lib-report";
import reports from "istanbul-reports";

const repoRoot = path.resolve(__dirname, "..");
const unitCoverageCandidates = [
  path.join(repoRoot, "coverage", "unit", "coverage-final.json"),
  path.join(repoRoot, "coverage", "coverage-final.json"),
];
const e2eCoverageCandidates = [
  path.join(repoRoot, "coverage", "e2e", "raw"),
  path.join(repoRoot, "coverage", "e2e"),
];
const mergedDir = path.join(repoRoot, "coverage", "merged");

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function loadCoverageFile(filePath: string, label: string): Promise<CoverageMapData> {
  const content = await fs.readFile(filePath, "utf-8");

  try {
    return JSON.parse(content) as CoverageMapData;
  } catch (error) {
    throw new Error(`Failed to parse ${label} coverage at ${path.relative(repoRoot, filePath)}: ${error}`);
  }
}

async function findUnitCoverage(): Promise<string> {
  for (const candidate of unitCoverageCandidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  const readablePaths = unitCoverageCandidates.map((candidate) => path.relative(repoRoot, candidate)).join(", ");
  throw new Error(`Unit coverage not found. Looked for: ${readablePaths}. Run \"npm run coverage:unit\" before merging.`);
}

async function collectJsonFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const resolvedPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(resolvedPath)));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(resolvedPath);
    }
=======
const UNIT_COVERAGE_PATH = path.join("coverage", "unit", "coverage-final.json");
const E2E_COVERAGE_GLOB = path.join("coverage", "e2e", "raw", "*.json");
const MERGED_DIR = path.join("coverage", "merged");
const MERGED_COVERAGE_PATH = path.join(MERGED_DIR, "coverage-final.json");

function normalizeCoveragePaths(data: CoverageMapData): CoverageMapData {
  const normalized: CoverageMapData = {};

  for (const [filePath, coverage] of Object.entries(data)) {
    const unixPath = filePath.replace(/\\\\/g, "/");
    normalized[unixPath] = coverage;
  }

  return normalized;
}

async function readCoverageJson(filePath: string): Promise<CoverageMapData> {
  const content = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(content) as CoverageMapData;
  return normalizeCoveragePaths(parsed);
}

async function ensureUnitCoverageExists(): Promise<void> {
  try {
    await fs.access(UNIT_COVERAGE_PATH);
  } catch {
    throw new Error(
      `Unit coverage not found at ${UNIT_COVERAGE_PATH}. Run \"npm run coverage:unit\" first.`,
    );
  }
}

async function getE2eCoverageFiles(): Promise<string[]> {
  const files = await glob(E2E_COVERAGE_GLOB);

  if (files.length === 0) {
    throw new Error(
      `No E2E coverage files found at ${E2E_COVERAGE_GLOB}. Run \"COVERAGE_E2E=1 BABEL_ENV=coverage_e2e npm run test:e2e\" first.`,
    );
>>>>>>> theirs
  }

  return files;
}

<<<<<<< ours
async function collectE2ECoverageMaps(): Promise<CoverageMapData[]> {
  const existingDirs = [];

  for (const candidate of e2eCoverageCandidates) {
    if (await fileExists(candidate)) {
      existingDirs.push(candidate);
    }
  }

  if (existingDirs.length === 0) {
    const readablePaths = e2eCoverageCandidates.map((candidate) => path.relative(repoRoot, candidate)).join(", ");
    throw new Error(`E2E coverage directory missing. Looked for: ${readablePaths}. Run the Playwright suite with coverage enabled.`);
  }

  const e2eJsonFiles = (
    await Promise.all(existingDirs.map(async (dir) => collectJsonFiles(dir)))
  ).flatMap((files) => files);

  if (e2eJsonFiles.length === 0) {
    const readablePaths = existingDirs.map((dir) => path.relative(repoRoot, dir)).join(", ");
    throw new Error(`No E2E coverage JSON files found under: ${readablePaths}.`);
  }

  return Promise.all(
    e2eJsonFiles.map(async (coveragePath) => loadCoverageFile(coveragePath, `E2E coverage file ${path.basename(coveragePath)}`))
  );
}

async function main(): Promise<void> {
  const unitCoveragePath = await findUnitCoverage();
  const coverageMap = createCoverageMap(await loadCoverageFile(unitCoveragePath, "unit coverage"));
  const e2eCoverageMaps = await collectE2ECoverageMaps();

  for (const map of e2eCoverageMaps) {
    coverageMap.merge(map);
  }

  await fs.mkdir(mergedDir, { recursive: true });

  const mergedOutputPath = path.join(mergedDir, "coverage-final.json");
  await fs.writeFile(mergedOutputPath, JSON.stringify(coverageMap.toJSON(), null, 2));

  const context = createContext({ dir: mergedDir, coverageMap });
  const tree = summarizers.pkg(coverageMap);
  const reporters = [
    reports.create("lcovonly", { file: "lcov.info" }),
    reports.create("html"),
    reports.create("text"),
  ];

  for (const reporter of reporters) {
    tree.visit(reporter, context);
  }

  console.log(`Merged coverage written to ${path.relative(repoRoot, mergedOutputPath)}`);
  console.log(`Reports available in ${path.relative(repoRoot, mergedDir)}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
>>>>>>> theirs
=======
async function main(): Promise<void> {
  await ensureUnitCoverageExists();

  const e2eFiles = await getE2eCoverageFiles();
  const coverageMap = createCoverageMap({});

  const unitCoverage = await readCoverageJson(UNIT_COVERAGE_PATH);
  coverageMap.merge(unitCoverage);

  for (const file of e2eFiles) {
    const e2eCoverage = await readCoverageJson(file);
    coverageMap.merge(e2eCoverage);
  }

  await fs.mkdir(MERGED_DIR, { recursive: true });
  await fs.writeFile(
    MERGED_COVERAGE_PATH,
    JSON.stringify(coverageMap.toJSON(), null, 2),
    "utf-8",
  );

  const context = createContext({
    dir: MERGED_DIR,
    coverageMap,
    defaultSummarizer: "nested",
  });

  const reportNames: Array<"html" | "lcovonly" | "text-summary"> = [
    "html",
    "lcovonly",
    "text-summary",
  ];

  for (const name of reportNames) {
    const report = reports.create(name);
    report.execute(context);
  }

  console.log(`Merged coverage written to ${MERGED_COVERAGE_PATH}`);
  console.log(`E2E coverage files merged: ${e2eFiles.length}`);
  console.log(`Total covered files: ${coverageMap.files().length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
>>>>>>> theirs
=======
import fs from "node:fs";
import path from "node:path";
import { createCoverageMap, type CoverageMap, type CoverageMapData } from "istanbul-lib-coverage";
import * as libReport from "istanbul-lib-report";
import reports from "istanbul-reports";

const repoRoot = path.resolve(__dirname, "..");
const unitCoveragePath = path.join(repoRoot, "coverage", "unit", "coverage-final.json");
const e2eCoverageDir = path.join(repoRoot, "coverage", "e2e", "raw");
const mergedDir = path.join(repoRoot, "coverage", "merged");

function readCoverageFile(filePath: string): CoverageMapData {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing coverage input at ${path.relative(repoRoot, filePath)}. Run unit and e2e coverage before merging.`,
    );
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as CoverageMapData;
}

function loadUnitCoverage(): CoverageMap {
  const coverageData = readCoverageFile(unitCoveragePath);
  return createCoverageMap(coverageData);
}

function loadE2eCoverage(): CoverageMap {
  const e2eMap = createCoverageMap({});

  if (!fs.existsSync(e2eCoverageDir)) {
    console.log("ℹ️ No e2e coverage directory found; merging unit coverage only.");
    return e2eMap;
  }

  const files = fs
    .readdirSync(e2eCoverageDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name);

  if (files.length === 0) {
    console.log("ℹ️ No e2e coverage JSON files found; merging unit coverage only.");
    return e2eMap;
  }

  for (const file of files) {
    const filePath = path.join(e2eCoverageDir, file);
    const coverageData = readCoverageFile(filePath);
    e2eMap.merge(coverageData);
  }

  console.log(`✅ Loaded ${files.length} e2e coverage file${files.length === 1 ? "" : "s"}.`);
  return e2eMap;
}

function writeReports(coverageMap: CoverageMap): void {
  fs.rmSync(mergedDir, { recursive: true, force: true });
  fs.mkdirSync(mergedDir, { recursive: true });

  const fileContext = libReport.createContext({
    dir: mergedDir,
    coverageMap,
    defaultSummarizer: "nested",
  });

  reports.create("json", { file: "coverage-final.json" }).execute(fileContext);
  reports.create("lcovonly", { file: "lcov.info" }).execute(fileContext);
  reports.create("html").execute(fileContext);

  const summaryReport = reports.create("text-summary", { file: "text-summary.txt" });
  summaryReport.execute(fileContext);

  const summaryPath = path.join(mergedDir, "text-summary.txt");
  if (fs.existsSync(summaryPath)) {
    const summary = fs.readFileSync(summaryPath, "utf8");
    console.log("\nMerged coverage summary:\n");
    console.log(summary.trim());
  }

  const htmlIndex = path.join(mergedDir, "index.html");
  console.log(`\nMerged coverage written to ${path.relative(repoRoot, htmlIndex)}.`);
}

function main(): void {
  const unitCoverage = loadUnitCoverage();
  const e2eCoverage = loadE2eCoverage();

  const mergedCoverage = createCoverageMap(unitCoverage.toJSON());
  mergedCoverage.merge(e2eCoverage);

  writeReports(mergedCoverage);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
>>>>>>> theirs
