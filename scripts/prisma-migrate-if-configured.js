const { spawnSync } = require('child_process');

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.log('[vercel-build] DATABASE_URL not set; skipping `prisma migrate deploy`.');
  process.exit(0);
}

const result = spawnSync('prisma', ['migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
});

if (result.status !== 0) {
  console.error('[vercel-build] `prisma migrate deploy` failed.');
  process.exit(result.status ?? 1);
}

console.log('[vercel-build] `prisma migrate deploy` completed successfully.');
