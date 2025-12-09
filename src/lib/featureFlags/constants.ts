export const FEATURE_FLAGS = {
  AGENTS: 'agents',
  AGENTS_MATCHED_UI_V1: 'agents.matched-ui-v1',
  SCORING: 'scoring',
  UI_BLOCKS: 'ui-blocks',
} as const;

export type FeatureFlagName = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export const DEFAULT_FLAG_DESCRIPTIONS: Record<FeatureFlagName, string> = {
  [FEATURE_FLAGS.AGENTS]: 'Controls all agent execution (RINA, RUA, Outreach, retries).',
  [FEATURE_FLAGS.AGENTS_MATCHED_UI_V1]: 'Gates the matched agent UI surface.',
  [FEATURE_FLAGS.SCORING]: 'Gates scoring and match computation flows.',
  [FEATURE_FLAGS.UI_BLOCKS]: 'Turns UI-only surfaces on or off.',
};
