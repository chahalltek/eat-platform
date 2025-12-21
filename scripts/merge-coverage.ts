import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { createCoverageMap, type CoverageMapData } from "istanbul-lib-coverage";
import { createContext } from "istanbul-lib-report";
import reports from "istanbul-reports";

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
  }
  return normalized;
}

function findFirstExisting(pathsToTry: string[]): string | null {
  for (const p of pathsToTry) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const unitPath = findFirstExisting(UNIT_COVERAGE_CANDIDATES);
  if (!unitPath) {
    throw new Error(
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
