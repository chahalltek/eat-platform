/// <reference types="vitest/globals" />

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_COVERAGE_THRESHOLD,
  DEFAULT_PIPELINE_COMMANDS,
  checkPipelineCompleteness,
  enforceTestCompleteness,
  ensurePrismaGeneration,
  runDeploymentHealth,
  validateMigrations,
} from "../../../scripts/deployment-health";

describe("deployment health gates", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "deploy-health-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeWorkflow(commands: string[]) {
    const workflowPath = path.join(tempDir, "workflow.yml");
    const content = commands.map((command) => `  run: ${command}`).join("\n");
    fs.writeFileSync(workflowPath, content, "utf8");
    return workflowPath;
  }

  function writeMigration(sql: string) {
    const migrationDir = path.join(tempDir, "prisma", "migrations", "20240101000000_sample");
    fs.mkdirSync(migrationDir, { recursive: true });
    fs.writeFileSync(path.join(migrationDir, "migration.sql"), sql, "utf8");
    return path.join(tempDir, "prisma", "migrations");
  }

  function writeCoverage(pct = 100) {
    const coverageDir = path.join(tempDir, "coverage");
    fs.mkdirSync(coverageDir, { recursive: true });
    const summary = {
      total: {
        lines: { pct },
        branches: { pct },
        functions: { pct },
        statements: { pct },
      },
    };
    const coveragePath = path.join(coverageDir, "coverage-summary.json");
    fs.writeFileSync(coveragePath, JSON.stringify(summary), "utf8");
    return coveragePath;
  }

  it("asserts pipeline completeness against required commands", () => {
    const workflowPath = writeWorkflow(DEFAULT_PIPELINE_COMMANDS);

    expect(() => checkPipelineCompleteness(workflowPath)).not.toThrow();
    expect(() => checkPipelineCompleteness(workflowPath, ["npm run build", "npm run lint"]))
      .not.toThrow();
  });

  it("fails when required pipeline steps are missing", () => {
    const workflowPath = writeWorkflow(["npm run lint"]);

    expect(() => checkPipelineCompleteness(workflowPath)).toThrow(
      /missing required steps: npm test, npm run build/,
    );
  });

  it("validates migrations are present and conflict-free", () => {
    const migrationsDir = writeMigration("CREATE TABLE demo (id INT);");

    expect(() => validateMigrations(migrationsDir)).not.toThrow();
    expect(() => validateMigrations(path.join(tempDir, "missing"))).not.toThrow();
  });

  it("catches merge markers in migrations", () => {
    const migrationsDir = writeMigration("CREATE TABLE demo (id INT);\n<<<<<<< HEAD\nDROP TABLE demo;\n>>>>>>>");

    expect(() => validateMigrations(migrationsDir)).toThrow(/unresolved merge markers/);
  });

  it("rejects empty migration files", () => {
    const migrationsDir = writeMigration("   \n  \n   ");

    expect(() => validateMigrations(migrationsDir)).toThrow(/contains no SQL/);
  });

  it("enforces coverage freshness and thresholds", () => {
    const coveragePath = writeCoverage(DEFAULT_COVERAGE_THRESHOLD + 1);

    expect(() => enforceTestCompleteness(coveragePath)).not.toThrow();
  });

  it("requires Prisma client generation to mirror the current schema", () => {
    const schemaPath = path.join(tempDir, "prisma", "schema.prisma");
    const generatedSchemaPath = path.join(tempDir, "node_modules", ".prisma", "client", "schema.prisma");

    const schemaContent = "datasource db { provider = \"postgresql\" }";
    fs.mkdirSync(path.dirname(schemaPath), { recursive: true });
    fs.mkdirSync(path.dirname(generatedSchemaPath), { recursive: true });
    fs.writeFileSync(schemaPath, schemaContent, "utf8");
    fs.writeFileSync(generatedSchemaPath, schemaContent, "utf8");

    expect(() => ensurePrismaGeneration(schemaPath, generatedSchemaPath)).not.toThrow();

    fs.writeFileSync(generatedSchemaPath, "different", "utf8");
    expect(() => ensurePrismaGeneration(schemaPath, generatedSchemaPath)).toThrow(/out of date/);
  });

  it("requires the generated Prisma client to exist", () => {
    const schemaPath = path.join(tempDir, "prisma", "schema.prisma");
    const generatedSchemaPath = path.join(tempDir, "node_modules", ".prisma", "client", "schema.prisma");

    const schemaContent = "datasource db { provider = \"postgresql\" }";
    fs.mkdirSync(path.dirname(schemaPath), { recursive: true });
    fs.writeFileSync(schemaPath, schemaContent, "utf8");

    expect(() => ensurePrismaGeneration(schemaPath, generatedSchemaPath)).toThrow(/has not been generated/);
  });

  it("injects a synthetic failure when requested", () => {
    const workflowPath = writeWorkflow(DEFAULT_PIPELINE_COMMANDS);
    const migrationsDir = writeMigration("CREATE TABLE demo (id INT);");
    const coveragePath = writeCoverage(100);
    const schemaPath = path.join(tempDir, "prisma", "schema.prisma");
    const generatedSchemaPath = path.join(tempDir, "node_modules", ".prisma", "client", "schema.prisma");
    fs.mkdirSync(path.dirname(schemaPath), { recursive: true });
    fs.mkdirSync(path.dirname(generatedSchemaPath), { recursive: true });
    fs.writeFileSync(schemaPath, "datasource db { provider = \"postgresql\" }", "utf8");
    fs.writeFileSync(generatedSchemaPath, "datasource db { provider = \"postgresql\" }", "utf8");

    expect(() =>
      runDeploymentHealth({
        validateConfigCommand: `${process.execPath} -e "process.exit(0)"`,
        testCommand: `${process.execPath} -e "process.exit(0)"`,
        workflowPath,
        migrationsDir,
        coveragePath,
        injectFailure: true,
        requiredCommands: ["npm test"],
        prismaSchemaPath: schemaPath,
        generatedPrismaSchemaPath: generatedSchemaPath,
      }),
    ).toThrow(/Failure injection requested/);
  });
});
