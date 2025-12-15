import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type Metric = {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
};

type CoverageEntry = {
  lines: Metric;
  functions: Metric;
  branches: Metric;
  statements: Metric;
};

type CoverageSummary = CoverageEntry & {
  total?: never;
  [filePath: string]: CoverageEntry | number | undefined;
};

const repoRoot = path.resolve(__dirname, "..");
const coverageDir = path.join(repoRoot, "coverage");
const summaryPath = path.join(coverageDir, "coverage-summary.json");
const coverageDetailsPath = path.join(coverageDir, "coverage-final.json");
const watchedExtensions = new Set([".ts", ".tsx"]);
const watchedRoots = ["src/"];
const requiredPct = 100;
const preferredBaseRef = process.env.COVERAGE_BASE_REF ?? "origin/main";

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function readJsonFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing coverage output at ${path.relative(repoRoot, filePath)}. Run \`npm run coverage\` before invoking this check.`,
    );
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function ensureCoverageTotals(summary: CoverageEntry): void {
  const metrics: Array<[keyof CoverageEntry, Metric]> = Object.entries(summary) as Array<[
    keyof CoverageEntry,
    Metric,
  ]>;
  const failures = metrics.filter(([, metric]) => metric.pct < requiredPct);

  if (failures.length > 0) {
    const detail = failures
      .map(([name, metric]) => `${name}: ${metric.pct}% (covered ${metric.covered}/${metric.total})`)
      .join("; ");

    throw new Error(`Coverage totals dipped below ${requiredPct}%: ${detail}`);
  }
}

function gitRefExists(ref: string): boolean {
  try {
    execSync(`git rev-parse --verify ${ref}^{commit}`, { cwd: repoRoot, stdio: "ignore" });
    return true;
  } catch (error) {
    return false;
  }
}

function resolveBaseRef(): string {
  const candidates = new Set<string>();
  try {
    const upstream = execSync("git rev-parse --abbrev-ref --symbolic-full-name @{u}", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .trim()
      .replace(/\s+/g, "");

    if (upstream) {
      candidates.add(upstream);
    }
  } catch (error) {
    // ignore; fall back to defaults
  }

  candidates.add(preferredBaseRef);
  candidates.add("origin/master");
  candidates.add("main");
  candidates.add("master");
  candidates.add("HEAD^");

  for (const candidate of candidates) {
    if (gitRefExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to locate a valid base branch. Set COVERAGE_BASE_REF to your upstream branch (for example, origin/main).`,
  );
}

function getAddedFiles(): string[] {
  const baseRef = resolveBaseRef();
  const diffTargets = [`${baseRef}...HEAD`, baseRef];
  for (const target of diffTargets) {
    try {
      const rawDiff = execSync(`git diff --name-only --diff-filter=A ${target}`, {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });

      if (rawDiff.trim().length === 0 && target.includes("...")) {
        // fall back to direct diff when merge-base is empty
        continue;
      }

      return rawDiff
        .split("\n")
        .map((file) => file.trim())
        .filter((file) => file.length > 0);
    } catch (error) {
      // try the next target
    }
  }

  throw new Error(
    `Unable to compute added files. Ensure the base ref exists or set COVERAGE_BASE_REF to the correct upstream branch.`,
  );
}

function isWatched(file: string): boolean {
  return (
    watchedExtensions.has(path.extname(file)) && watchedRoots.some((root) => normalizePath(file).startsWith(normalizePath(root)))
  );
}

function buildCoverageMap(summary: Record<string, CoverageEntry | { total?: number }>): Map<string, CoverageEntry> {
  const entries = new Map<string, CoverageEntry>();
  for (const [filePath, entry] of Object.entries(summary)) {
    if (filePath === "total") continue;
    const coverageEntry = entry as CoverageEntry;
    const normalized = normalizePath(path.isAbsolute(filePath) ? path.relative(repoRoot, filePath) : filePath);
    entries.set(normalized, coverageEntry);
  }

  return entries;
}

function findCoverageFor(file: string, coverageMap: Map<string, CoverageEntry>): CoverageEntry | undefined {
  const normalized = normalizePath(file);
  if (coverageMap.has(normalized)) {
    return coverageMap.get(normalized);
  }

  const absolute = normalizePath(path.resolve(repoRoot, file));
  return coverageMap.get(absolute);
}

function main(): void {
  const summary = readJsonFile<Record<string, CoverageEntry | CoverageEntry>>(summaryPath);
  const totals = (summary.total ?? summary["total"]) as CoverageEntry | undefined;

  if (!totals) {
    throw new Error(`Coverage summary is missing the \"total\" section at ${path.relative(repoRoot, summaryPath)}.`);
  }

  ensureCoverageTotals(totals);

  const coverageMap = buildCoverageMap(summary);
  const addedFiles = getAddedFiles();
  const watchedFiles = addedFiles.filter(isWatched);

  if (watchedFiles.length === 0) {
    console.log("✅ No new watched files detected; coverage debt unchanged.");
    return;
  }

  const uncovered = watchedFiles
    .map((file) => ({
      file,
      coverage: findCoverageFor(file, coverageMap),
    }))
    .filter(({ coverage }) => !coverage || coverage.lines.pct === 0);

  if (uncovered.length > 0) {
    const detail = uncovered
      .map(({ file, coverage }) => {
        if (!coverage) {
          return `${file} has no coverage entry (treated as 0%)`;
        }
        return `${file} reports ${coverage.lines.covered}/${coverage.lines.total} lines covered (${coverage.lines.pct}%)`;
      })
      .join("\n");

    throw new Error(`New files must not land with 0% coverage:\n${detail}`);
  }

  console.log("✅ Coverage debt check passed: new watched files are covered and totals remain at 100%.");
}

try {
  // Ensure the coverage artifacts exist before attempting to read them.
  readJsonFile<Record<string, unknown>>(coverageDetailsPath);
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
