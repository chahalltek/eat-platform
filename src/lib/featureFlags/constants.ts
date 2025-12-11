export const FEATURE_FLAGS = {
  AGENTS: 'agents',
  AGENTS_MATCHED_UI_V1: 'agents.matched-ui-v1',
<<<<<<< ours
  FIRE_DRILL_MODE: 'fire-drill-mode',
=======
  CONFIDENCE_ENABLED: 'ete_confidence_enabled',
>>>>>>> theirs
  SCORING: 'scoring',
  UI_BLOCKS: 'ui-blocks',
} as const;

export type FeatureFlagName = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export const DEFAULT_FLAG_DESCRIPTIONS: Record<FeatureFlagName, string> = {
  [FEATURE_FLAGS.AGENTS]: 'Controls all agent execution (RINA, RUA, Outreach, retries).',
  [FEATURE_FLAGS.AGENTS_MATCHED_UI_V1]: 'Gates the matched agent UI surface.',
<<<<<<< ours
  [FEATURE_FLAGS.FIRE_DRILL_MODE]: 'Forces Fire Drill mode during incidents to reduce agent blast radius.',
=======
  [FEATURE_FLAGS.CONFIDENCE_ENABLED]: 'Gates confidence scoring surfaces and messaging.',
>>>>>>> theirs
  [FEATURE_FLAGS.SCORING]: 'Gates scoring and match computation flows.',
  [FEATURE_FLAGS.UI_BLOCKS]: 'Turns UI-only surfaces on or off.',
};

export const FEATURE_FLAG_ALIASES: Partial<Record<string, FeatureFlagName>> = {
  eat_confidence_enabled: FEATURE_FLAGS.CONFIDENCE_ENABLED,
};
