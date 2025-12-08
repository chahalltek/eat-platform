#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");
const DEFAULT_PIPELINE_COMMANDS = ["npm run lint", "npm test", "npm run build"];
const DEFAULT_COVERAGE_THRESHOLD = 100;
const DEFAULT_MAX_COVERAGE_AGE_HOURS = 24;
const DEFAULT_TEST_COMMAND = "npm test";
const DEFAULT_CONFIG_VALIDATE_COMMAND = "npm run ci:config-validate";

function fail(message) {
  throw new Error(message);
}

function readFileContent(targetPath, friendlyName) {
  if (!fs.existsSync(targetPath)) {
    fail(`${friendlyName} is missing at ${targetPath}.`);
  }

  return fs.readFileSync(targetPath, "utf8");
}

function runCommand(command, friendlyName) {
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`${friendlyName} failed. ${message}`);
  }

  return { command };
}

function checkPipelineCompleteness(
  workflowPath = path.join(process.cwd(), ".github", "workflows", "test.yml"),
  requiredCommands = DEFAULT_PIPELINE_COMMANDS,
) {
  const contents = readFileContent(workflowPath, "Pipeline workflow");
  const missing = requiredCommands.filter((command) => !contents.includes(command));

  if (missing.length > 0) {
    fail(`Pipeline is missing required steps: ${missing.join(", ")}`);
  }

  return {
    workflowPath,
    commands: requiredCommands,
  };
}

function validateMigrations(migrationsDir = path.join(process.cwd(), "prisma", "migrations")) {
  if (!fs.existsSync(migrationsDir)) {
    return { migrationsChecked: 0 };
  }

  const folders = fs
    .readdirSync(migrationsDir)
    .filter((entry) => fs.statSync(path.join(migrationsDir, entry)).isDirectory());

  let checked = 0;

  folders.forEach((folder) => {
    const migrationPath = path.join(migrationsDir, folder, "migration.sql");
    const contents = readFileContent(migrationPath, `Migration ${folder}`);
    const trimmed = contents.trim();

    if (trimmed.length === 0) {
      fail(`Migration ${folder} contains no SQL. Add statements or remove the migration.`);
    }

    if (/<<<<<|>>>>>|=====/m.test(contents)) {
      fail(`Migration ${folder} has unresolved merge markers. Resolve conflicts before deploying.`);
    }

    checked += 1;
  });

  return { migrationsChecked: checked };
}

function enforceTestCompleteness(
  coveragePath = path.join(process.cwd(), "coverage", "coverage-summary.json"),
  minimumCoverage = DEFAULT_COVERAGE_THRESHOLD,
  maxAgeHours = DEFAULT_MAX_COVERAGE_AGE_HOURS,
) {
  const coverageContent = readFileContent(coveragePath, "Coverage summary");
  let summary;

  try {
    summary = JSON.parse(coverageContent);
  } catch (error) {
    fail(`Coverage summary at ${coveragePath} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }

  const total = summary.total;
  if (!total) {
    fail("Coverage summary is missing the total section.");
  }

  const metrics = ["lines", "branches", "functions", "statements"];
  const missingMetrics = metrics.filter((metric) => !total[metric]);
  if (missingMetrics.length > 0) {
    fail(`Coverage summary is missing metrics: ${missingMetrics.join(", ")}`);
  }

  metrics.forEach((metric) => {
    const pct = total[metric].pct;
    if (typeof pct !== "number") {
      fail(`Coverage metric ${metric} is missing pct value.`);
    }

    if (pct < minimumCoverage) {
      fail(`Coverage for ${metric} is below ${minimumCoverage}% (received ${pct}%).`);
    }
  });

  const ageMs = Date.now() - fs.statSync(coveragePath).mtimeMs;
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  if (ageMs > maxAgeMs) {
    fail(`Coverage data is older than ${maxAgeHours} hours. Re-run tests before deploying.`);
  }

  return { minimumCoverage, checkedMetrics: metrics.length };
}

function ensurePrismaGeneration(
  schemaPath = path.join(process.cwd(), "prisma", "schema.prisma"),
  generatedSchemaPath = path.join(process.cwd(), "node_modules", ".prisma", "client", "schema.prisma"),
) {
  const schemaContent = readFileContent(schemaPath, "Prisma schema");

  if (!fs.existsSync(path.dirname(generatedSchemaPath))) {
    fail(
      `Prisma client has not been generated. Run \`prisma generate\` so ${generatedSchemaPath} exists before deploying.`,
    );
  }

  const generatedContent = readFileContent(generatedSchemaPath, "Generated Prisma client schema");

  const sourceHash = crypto.createHash("sha256").update(schemaContent).digest("hex");
  const generatedHash = crypto.createHash("sha256").update(generatedContent).digest("hex");

  if (sourceHash !== generatedHash) {
    fail("Prisma client schema is out of date. Run `prisma generate` to refresh the client before deployment.");
  }

  return { schemaPath, generatedSchemaPath };
}

function validateEnvironment(command = DEFAULT_CONFIG_VALIDATE_COMMAND) {
  return runCommand(command, "Configuration validation");
}

function runTests(command = DEFAULT_TEST_COMMAND) {
  return runCommand(command, "Test suite");
}

function runDeploymentHealth(options = {}) {
  const {
    workflowPath,
    requiredCommands,
    migrationsDir,
    coveragePath,
    minimumCoverage,
    maxCoverageAgeHours,
    injectFailure = false,
    prismaSchemaPath,
    generatedPrismaSchemaPath,
    testCommand,
    validateConfigCommand,
  } = options;

  const reports = [];
  reports.push(validateEnvironment(validateConfigCommand));
  reports.push(runTests(testCommand));
  reports.push(checkPipelineCompleteness(workflowPath, requiredCommands));
  reports.push(validateMigrations(migrationsDir));
  reports.push(enforceTestCompleteness(coveragePath, minimumCoverage, maxCoverageAgeHours));
  reports.push(ensurePrismaGeneration(prismaSchemaPath, generatedPrismaSchemaPath));

  if (injectFailure || process.env.FAIL_DEPLOYMENT_HEALTH === "true") {
    fail("Failure injection requested. Deployment health gate intentionally failed.");
  }

  return reports;
}

function log(message) {
  console.log(`[deploy-health] ${message}`);
}

if (require.main === module) {
  try {
    const injectFailure = process.argv.includes("--inject-failure");
    runDeploymentHealth({ injectFailure });
    log("Deployment health gates passed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[deploy-health] ${message}`);
    process.exit(1);
  }
}

module.exports = {
  checkPipelineCompleteness,
  validateMigrations,
  enforceTestCompleteness,
  ensurePrismaGeneration,
  runDeploymentHealth,
  DEFAULT_PIPELINE_COMMANDS,
  DEFAULT_COVERAGE_THRESHOLD,
  DEFAULT_MAX_COVERAGE_AGE_HOURS,
  DEFAULT_TEST_COMMAND,
  DEFAULT_CONFIG_VALIDATE_COMMAND,
};
