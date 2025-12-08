import packageJson from '../../../package.json';

type EnvEntry = {
  key: string;
  value: string | null;
  redacted: boolean;
};

type VersionInfo = {
  appVersion: string;
  nextVersion?: string;
  prismaVersion?: string;
  nodeVersion: string;
};

type EnvSnapshot = {
  runtimeEnv: EnvEntry[];
  flags: EnvEntry[];
  versions: VersionInfo;
};

const REDACT_PATTERNS = [
  'KEY',
  'SECRET',
  'TOKEN',
  'PASSWORD',
  'PRIVATE',
  'DATABASE_URL',
  'CONNECTION',
  'AUTH',
  'API',
];

function isRedactedKey(key: string) {
  const normalized = key.toUpperCase();
  return REDACT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function maskValue(value: string | null) {
  if (!value) return '••••';
  const visibleLength = Math.min(Math.max(value.length, 6), 12);
  return '•'.repeat(visibleLength);
}

function sanitizeEnvRecord(entries: [string, string | undefined][]): EnvEntry[] {
  return entries
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const redacted = isRedactedKey(key);
      return {
        key,
        value: redacted ? maskValue(value ?? null) : value ?? null,
        redacted,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function getEnvironmentSnapshot(): EnvSnapshot {
  const envEntries = Object.entries(process.env);
  const flagEntries = envEntries.filter(([key]) => key.startsWith('FLAG_'));
  const runtimeEntries = envEntries.filter(([key]) => !key.startsWith('FLAG_'));

  return {
    runtimeEnv: sanitizeEnvRecord(runtimeEntries),
    flags: sanitizeEnvRecord(flagEntries),
    versions: {
      appVersion: packageJson.version ?? 'unknown',
      nextVersion: packageJson.dependencies?.next,
      prismaVersion: packageJson.dependencies?.['@prisma/client'],
      nodeVersion: process.version,
    },
  };
}

export type { EnvEntry, EnvSnapshot, VersionInfo };
