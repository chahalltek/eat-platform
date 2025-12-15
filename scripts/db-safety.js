#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const checkOnly = args.includes('--ci');
const prismaArgs = checkOnly ? [] : args.filter((arg) => arg !== '--ci');

const { resolveDatabaseUrl } = require('./utils/resolve-database-url');

const resolvedEnv = (process.env.DEPLOYMENT_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || '').toLowerCase();
const isProduction = resolvedEnv === 'production' || resolvedEnv === 'prod';
const overrideSafety = process.env.DB_SAFETY_OVERRIDE === 'true';
const enforceSafety = isProduction && !checkOnly;

const resolvedDatabaseUrl = resolveDatabaseUrl(process.env);

if (resolvedDatabaseUrl) {
  process.env.DATABASE_URL = resolvedDatabaseUrl;
}

function fail(message) {
  console.error(`\n[db-safety] ${message}\n`);
  process.exit(1);
}

function log(message) {
  console.log(`[db-safety] ${message}`);
}

function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL must be set in production to run Prisma commands safely.');
  }
}

function scanMigrationsForDestructiveSql() {
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const ignoreToken = /db-safety-ignore-destructive/i;
  const destructivePatterns = [
    /drop\s+table/i,
    /drop\s+column/i,
    /alter\s+table[^;]*drop/i,
    /truncate\s+table/i,
  ];

  const migrations = fs.readdirSync(migrationsDir).filter((entry) => {
    const fullPath = path.join(migrationsDir, entry);
    return fs.statSync(fullPath).isDirectory();
  });

  migrations.forEach((folder) => {
    const migrationSql = path.join(migrationsDir, folder, 'migration.sql');
    if (!fs.existsSync(migrationSql)) {
      return;
    }

    const content = fs.readFileSync(migrationSql, 'utf8');

    if (ignoreToken.test(content)) {
      log(`Ignoring destructive SQL check for ${path.relative(process.cwd(), migrationSql)} due to opt-out token.`);
      return;
    }

    destructivePatterns.forEach((pattern) => {
      if (pattern.test(content)) {
        fail(
          `Destructive SQL detected in ${path.relative(process.cwd(), migrationSql)}. ` +
            'Use a non-production environment for destructive changes or provide a safer migration.',
        );
      }
    });
  });
}

function guardPrismaCommand(commandArgs) {
  if (commandArgs.length === 0) {
    return;
  }

  const normalized = commandArgs.map((arg) => arg.toLowerCase());
  const commandKey = normalized.slice(0, 2).join(' ');

  const blockedCommands = [
    'migrate dev',
    'migrate reset',
    'db push',
    'db execute',
  ];

  if (blockedCommands.includes(commandKey)) {
    fail(`Prisma command "${commandArgs.join(' ')}" is blocked in production.`);
  }

  const forceFlags = ['--force', '--accept-data-loss'];
  const hasForceFlag = normalized.some((arg) => forceFlags.includes(arg));

  if (hasForceFlag) {
    fail('Forceful Prisma flags are disabled in production.');
  }

  log(`Prisma command "${commandArgs.join(' ')}" cleared safety checks.`);
}

function runMigrationStatus({ enforce }) {
  const result = spawnSync('prisma', ['migrate', 'status'], {
    env: process.env,
    stdio: 'pipe',
    encoding: 'utf-8',
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (result.status !== 0) {
    const message = `Unable to read Prisma migration status. Prisma exited with status ${result.status}.\n${output}`;
    if (enforce) {
      fail(message);
    }

    log(message);
    return null;
  }

  return output;
}

function parsePendingMigrations(output) {
  const normalized = output.toLowerCase();
  const isUpToDate = normalized.includes('database schema is up to date');

  const pendingPatterns = [
    /not yet been applied/i,
    /database schema is not in sync/i,
    /drift detected/i,
    /pending migration/i,
  ];

  const pendingNames = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[0-9]{10,}.*/.test(line));

  const pendingDetected = pendingPatterns.some((pattern) => pattern.test(output));

  return {
    isUpToDate,
    pendingDetected: pendingDetected || pendingNames.length > 0,
    pendingNames,
  };
}

function checkMigrationDrift({ enforce }) {
  if (!process.env.DATABASE_URL) {
    log('DATABASE_URL is not set; skipping migration drift check.');
    return;
  }

  const statusOutput = runMigrationStatus({ enforce });
  if (!statusOutput) {
    return;
  }
  const { isUpToDate, pendingDetected, pendingNames } = parsePendingMigrations(statusOutput);

  if (isUpToDate) {
    log('Database schema is up to date with Prisma migrations.');
    return;
  }

  const pendingSummary = pendingNames.length > 0 ? ` (${pendingNames.join(', ')})` : '';
  const message = `Pending Prisma migrations detected${pendingSummary}. Apply migrations to the target database.`;

  if (enforce) {
    fail(message);
  }

  const outputHeading = pendingDetected ? 'Migration status output:' : 'Prisma migrate status output:';
  log(message);
  log(`${outputHeading}\n${statusOutput.trim()}`);
}

if (!isProduction) {
  log(`Non-production environment detected (${resolvedEnv || 'unknown'}). Safety guard is informational only.`);
  checkMigrationDrift({ enforce: false });
  if (prismaArgs.length) {
    log('Prisma commands are not being restricted outside production.');
  }
  process.exit(0);
}

if (overrideSafety) {
  log('DB_SAFETY_OVERRIDE is true, but guardrails cannot be bypassed. Running safety checks.');
}

if (enforceSafety) {
  requireDatabaseUrl();
}

if (!enforceSafety) {
  log('Production environment detected but running in check-only mode; reporting issues without failing.');
}

checkMigrationDrift({ enforce: enforceSafety });

if (!checkOnly) {
  guardPrismaCommand(prismaArgs);
}

scanMigrationsForDestructiveSql();

log(enforceSafety ? 'Production database safety checks passed.' : 'Production database safety checks completed in non-enforcing mode.');
