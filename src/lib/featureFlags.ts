import { prisma } from './prisma';

export const FEATURE_FLAGS = {
  AGENTS: 'agents',
  SCORING: 'scoring',
  UI_BLOCKS: 'ui-blocks',
} as const;

export type FeatureFlagName = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export type FeatureFlagRecord = {
  name: FeatureFlagName;
  description: string | null;
  enabled: boolean;
  updatedAt: Date;
};

const DEFAULT_FLAG_DESCRIPTIONS: Record<FeatureFlagName, string> = {
  [FEATURE_FLAGS.AGENTS]: 'Controls all agent execution (RINA, RUA, Outreach, retries).',
  [FEATURE_FLAGS.SCORING]: 'Gates scoring and match computation flows.',
  [FEATURE_FLAGS.UI_BLOCKS]: 'Turns UI-only surfaces on or off.',
};

const flagCache = new Map<FeatureFlagName, boolean>();

function coerceFlagName(value: unknown): FeatureFlagName | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const candidates = Object.values(FEATURE_FLAGS) as FeatureFlagName[];

  return (candidates.find((flag) => flag === normalized) as FeatureFlagName | undefined) ?? null;
}

async function ensureFlagExists(name: FeatureFlagName) {
  const flag = await prisma.featureFlag.upsert({
    where: { name },
    update: {},
    create: { name, description: DEFAULT_FLAG_DESCRIPTIONS[name] },
  });

  flagCache.set(name, flag.enabled);

  return flag;
}

export async function listFeatureFlags(): Promise<FeatureFlagRecord[]> {
  const flags = await Promise.all(
    (Object.values(FEATURE_FLAGS) as FeatureFlagName[]).map((name) => ensureFlagExists(name)),
  );

  return flags
    .map((flag) => ({
      name: flag.name as FeatureFlagName,
      description: flag.description,
      enabled: flag.enabled,
      updatedAt: flag.updatedAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function isFeatureEnabled(name: FeatureFlagName): Promise<boolean> {
  const cached = flagCache.get(name);

  if (cached != null) {
    return cached;
  }

  const flag = await ensureFlagExists(name);

  return flag.enabled;
}

export const isEnabled = isFeatureEnabled;

export async function setFeatureFlag(name: FeatureFlagName, enabled: boolean): Promise<FeatureFlagRecord> {
  const flag = await prisma.featureFlag.upsert({
    where: { name },
    update: { enabled },
    create: { name, enabled, description: DEFAULT_FLAG_DESCRIPTIONS[name] },
  });

  flagCache.set(name, flag.enabled);

  return {
    name: flag.name as FeatureFlagName,
    description: flag.description,
    enabled: flag.enabled,
    updatedAt: flag.updatedAt,
  };
}

export function parseFeatureFlagName(value: unknown): FeatureFlagName | null {
  return coerceFlagName(value);
}

export function describeFeatureFlag(name: FeatureFlagName) {
  return DEFAULT_FLAG_DESCRIPTIONS[name];
}
