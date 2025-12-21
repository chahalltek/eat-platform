/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { createCoverageMap } = require("istanbul-lib-coverage");
const { createContext } = require("istanbul-lib-report");
const reports = require("istanbul-reports");

const repoRoot = path.resolve(__dirname, "..");
const sources = [
  path.join(repoRoot, "coverage", "unit", "coverage-final.json"),
  path.join(repoRoot, "coverage", "e2e", "coverage-final.json"),
];

function readCoverage(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Skipping missing coverage file: ${path.relative(repoRoot, filePath)}`);
    return undefined;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse coverage file at ${filePath}: ${error instanceof Error ? error.message : error}`);
  }
}

function mergeCoverage() {
  const coverageMap = createCoverageMap({});

  for (const source of sources) {
    const data = readCoverage(source);
    if (data) {
      coverageMap.merge(data);
      console.log(`✅ Merged coverage from ${path.relative(repoRoot, source)}`);
    }
  }

  if (coverageMap.files().length === 0) {
    throw new Error("No coverage data found to merge. Run unit and E2E coverage first.");
  }

  const outputDir = path.join(repoRoot, "coverage", "merged");
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const context = createContext({ dir: outputDir, coverageMap });
  const reporterConfigs = [
    ["text", {}],
    ["json", { file: "coverage-final.json" }],
    ["json-summary", { file: "coverage-summary.json" }],
    ["lcovonly", { file: "lcov.info" }],
    ["html", {}],
  ];

  for (const [name, options] of reporterConfigs) {
    reports.create(name, options).execute(context);
  }

  console.log(`📁 Merged coverage reports written to ${path.relative(repoRoot, outputDir)}`);
}

mergeCoverage();
