import { describe, expect, it, vi } from 'vitest';

import { FEATURE_FLAGS, describeFeatureFlag, parseFeatureFlagName } from '@/lib/featureFlags';

describe('featureFlags', () => {
  it('parses canonical names and aliases', () => {
    expect(parseFeatureFlagName('agents')).toBe(FEATURE_FLAGS.AGENTS);
    expect(parseFeatureFlagName(' AGENTS ')).toBe(FEATURE_FLAGS.AGENTS);
    expect(parseFeatureFlagName('ete_confidence_enabled')).toBe(FEATURE_FLAGS.CONFIDENCE_ENABLED);
    expect(parseFeatureFlagName('unknown-flag')).toBeNull();
  });

  it('describes feature flags using the defaults table', () => {
    expect(describeFeatureFlag(FEATURE_FLAGS.AGENTS)).toContain('agent execution');
    expect(describeFeatureFlag(FEATURE_FLAGS.SCORING)).toContain('scoring');
  });

  it('reloads environment defaults when resetting from env', async () => {
    const mockDefaults = vi.fn().mockReturnValue(new Map([[FEATURE_FLAGS.AGENTS, true]]));
    vi.resetModules();

    vi.doMock('@/lib/deployment/deploymentModes', async () => {
      const actual = await vi.importActual<typeof import('@/lib/deployment/deploymentModes')>(
        '@/lib/deployment/deploymentModes',
      );

      return { ...actual, getDeploymentFeatureFlagDefaults: mockDefaults };
    });

    const featureFlags = await import('@/lib/featureFlags');
    const env = {
      DEFAULT_FEATURE_FLAGS: 'agents=true',
      NODE_ENV: 'test',
      APP_ENV: 'test',
    } as NodeJS.ProcessEnv;

    featureFlags.resetEnvironmentFeatureFlagDefaults(env);

    expect(mockDefaults).toHaveBeenCalledWith(env);
  });
});
