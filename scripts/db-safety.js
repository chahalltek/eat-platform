#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const checkOnly = args.includes('--ci');
const prismaArgs = checkOnly ? [] : args.filter((arg) => arg !== '--ci');

const resolvedEnv = (process.env.DEPLOYMENT_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || '').toLowerCase();
const isProduction = resolvedEnv === 'production' || resolvedEnv === 'prod';
const overrideSafety = process.env.DB_SAFETY_OVERRIDE === 'true';

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

if (!isProduction) {
  log(`Non-production environment detected (${resolvedEnv || 'unknown'}). Safety guard is informational only.`);
  if (prismaArgs.length) {
    log('Prisma commands are not being restricted outside production.');
  }
  process.exit(0);
}

if (overrideSafety) {
  log('DB_SAFETY_OVERRIDE is true. Production guardrails are disabled for this run.');
  process.exit(0);
}

requireDatabaseUrl();

if (!checkOnly) {
  guardPrismaCommand(prismaArgs);
}

scanMigrationsForDestructiveSql();

log('Production database safety checks passed.');
