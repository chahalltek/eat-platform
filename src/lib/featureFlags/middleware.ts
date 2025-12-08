import { NextResponse } from 'next/server';

import { FEATURE_FLAGS, FeatureFlagName, isFeatureEnabled } from '@/lib/featureFlags';

export type FeatureFlagMiddlewareContext = {
  featureName?: string;
  fallbackStatus?: number;
};

export async function enforceFeatureFlag(
  flagName: FeatureFlagName,
  context: FeatureFlagMiddlewareContext = {},
) {
  const enabled = await isFeatureEnabled(flagName);

  if (enabled) {
    return null;
  }

  const label = context.featureName ?? `${flagName} feature`;
  const status = context.fallbackStatus ?? 503;

  return NextResponse.json({ error: `${label} is currently disabled` }, { status });
}

export function getAgentFeatureName(agentName: string) {
  if (agentName.toUpperCase().includes('RINA')) return 'RINA agent';
  if (agentName.toUpperCase().includes('RUA')) return 'RUA agent';
  if (agentName.toUpperCase().includes('OUTREACH')) return 'Outreach agent';

  return 'Agent run';
}

export function agentFeatureGuard() {
  return enforceFeatureFlag(FEATURE_FLAGS.AGENTS, { featureName: 'Agents' });
}
