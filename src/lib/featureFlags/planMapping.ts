import { FEATURE_FLAGS, type FeatureFlagName } from './constants';

export type PlanFeatureFlagMapping = Record<string, FeatureFlagName[]>;

const DEFAULT_PLAN_FEATURE_FLAGS: PlanFeatureFlagMapping = {
  'plan-standard': [FEATURE_FLAGS.UI_BLOCKS],
  'plan-premium': [FEATURE_FLAGS.UI_BLOCKS, FEATURE_FLAGS.AGENTS, FEATURE_FLAGS.SCORING],
};

let planFeatureFlagMapping = buildMapping(DEFAULT_PLAN_FEATURE_FLAGS);

function buildMapping(mapping: PlanFeatureFlagMapping) {
  return new Map<string, Set<FeatureFlagName>>(
    Object.entries(mapping).map(([planId, flags]) => [planId, new Set(flags)]),
  );
}

export function configurePlanFeatureFlags(mapping: PlanFeatureFlagMapping) {
  planFeatureFlagMapping = buildMapping(mapping);
}

export function resetPlanFeatureFlags() {
  planFeatureFlagMapping = buildMapping(DEFAULT_PLAN_FEATURE_FLAGS);
}

export function isFeatureEnabledForPlan(planId: string, feature: FeatureFlagName) {
  return planFeatureFlagMapping.get(planId)?.has(feature) ?? false;
}

export function getPlanFeatureFlagMapping() {
  return planFeatureFlagMapping;
}
