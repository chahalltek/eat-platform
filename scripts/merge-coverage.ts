import fs from "node:fs";
import path from "node:path";
import { createCoverageMap, type CoverageMapData } from "istanbul-lib-coverage";
import { createContext } from "istanbul-lib-report";
import reports from "istanbul-reports";

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
