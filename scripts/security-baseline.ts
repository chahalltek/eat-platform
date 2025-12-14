import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function runRipgrep(pattern: string, args: string[] = []) {
  try {
    const ripgrepArgs = pattern ? [pattern, ...args] : args;

    return execFileSync('rg', ripgrepArgs, { encoding: 'utf8' });
  } catch (error: unknown) {
    const err = error as { status?: number; stdout?: string };

    if (err.status === 1) {
      return '';
    }

    throw error;
  }
}

function listFiles(glob: string) {
  const output = runRipgrep('', ['--files', '-g', `'${glob}'`]);

  return output
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

function fail(message: string, details: string[]) {
  console.error(`\n${message}`);
  details.forEach((detail) => console.error(`  - ${detail}`));
  process.exit(1);
}

function checkOpenAIImports() {
  const matches = runRipgrep("from ['\"]openai['\"]", ['--files-with-matches']).split('\n');
  const files = matches.filter(Boolean);

  const violations = files.filter((file) => !file.startsWith('src/server/ai/'));

  if (violations.length > 0) {
    fail('OpenAI client imports are restricted to src/server/ai/.', violations);
  }
}

function checkFeatureFlagAssertions() {
  const repoRoot = process.cwd();
  const guardrails: Array<{ glob: string; flag: string; label: string; exemptions?: string[] }> = [
    {
      glob: 'src/app/api/agents/**/route.ts',
      flag: 'FEATURE_FLAGS.AGENTS',
      label: 'Agents API routes',
      exemptions: ['src/app/api/agents/profile/route.ts'],
    },
    {
      glob: 'src/app/api/match/route.ts',
      flag: 'FEATURE_FLAGS.SCORING',
      label: 'Match scoring API route',
    },
  ];

  const violations: string[] = [];

  guardrails.forEach(({ glob, flag, label, exemptions = [] }) => {
    const files = listFiles(glob);

    files.forEach((file) => {
      if (exemptions.includes(file)) return;

      const content = readFileSync(path.join(repoRoot, file), 'utf8');
      const hasAssert = content.includes('assertFeatureEnabled');
      const mentionsFlag = content.includes(flag);

      if (!hasAssert || !mentionsFlag) {
        violations.push(`${file} is missing assertFeatureEnabled for ${flag} (${label}).`);
      }
    });
  });

  if (violations.length > 0) {
    fail('Restricted endpoints must assert feature-flag access.', violations);
  }
}

function main() {
  checkOpenAIImports();
  checkFeatureFlagAssertions();

  console.log('Security baseline checks passed.');
}

main();
