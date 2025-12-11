const { spawnSync } = require('child_process');

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.log('[vercel-build] DATABASE_URL not set; skipping `prisma migrate deploy`.');
  process.exit(0);
}

const result = spawnSync('prisma', ['migrate', 'deploy'], {
  stdio: 'pipe',
  env: process.env,
  encoding: 'utf-8',
});

// Mirror Prisma output so logs stay visible in CI.
if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.status !== 0) {
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (output.includes('P3009')) {
    console.warn(
      '[vercel-build] `prisma migrate deploy` failed with P3009 (failed migration found). ' +
        'Skipping migration application so build can continue; please resolve the failed migration in the target database.',
    );
    process.exit(0);
  }

  console.error('[vercel-build] `prisma migrate deploy` failed.');
  process.exit(result.status ?? 1);
}

console.log('[vercel-build] `prisma migrate deploy` completed successfully.');
