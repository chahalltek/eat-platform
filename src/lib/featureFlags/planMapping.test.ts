import { afterEach, describe, expect, it } from 'vitest';

import { FEATURE_FLAGS } from './constants';
import {
  configurePlanFeatureFlags,
  getPlanFeatureFlagMapping,
  isFeatureEnabledForPlan,
  resetPlanFeatureFlags,
} from './planMapping';

describe('plan feature flag mapping', () => {
  afterEach(() => {
    resetPlanFeatureFlags();
  });

  it('enables defaults for known plans', () => {
    expect(isFeatureEnabledForPlan('plan-premium', FEATURE_FLAGS.AGENTS)).toBe(true);
    expect(isFeatureEnabledForPlan('plan-standard', FEATURE_FLAGS.AGENTS)).toBe(false);
  });

  it('allows custom mappings to override defaults', () => {
    configurePlanFeatureFlags({ 'plan-custom': [FEATURE_FLAGS.SCORING] });

    expect(isFeatureEnabledForPlan('plan-custom', FEATURE_FLAGS.SCORING)).toBe(true);
    expect(isFeatureEnabledForPlan('plan-premium', FEATURE_FLAGS.SCORING)).toBe(false);
  });

  it('exposes the current mapping for inspection', () => {
    configurePlanFeatureFlags({ 'plan-lite': [FEATURE_FLAGS.UI_BLOCKS] });

    const mapping = getPlanFeatureFlagMapping();

    expect(mapping.get('plan-lite')?.has(FEATURE_FLAGS.UI_BLOCKS)).toBe(true);
    expect(mapping.get('plan-premium')).toBeUndefined();
  });
});
