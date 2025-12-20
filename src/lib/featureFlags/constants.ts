export const FEATURE_FLAGS = {
  AGENTS: 'agents',
  AGENTS_MATCHED_UI_V1: 'agents.matched-ui-v1',
  CONFIDENCE_ENABLED: 'ete_confidence_enabled',
  CLIENT_CONFIDENCE_SIGNAL: 'client-confidence-signal',
  FIRE_DRILL_MODE: 'fire-drill-mode',
  JUDGMENT_MEMORY: 'judgment-memory',
  DECISION_MOMENT_CUES: 'decision-moment-cues',
  SOP_CONTEXTUAL_LINKS: 'sop-contextual-links',
  DECISION_CULTURE_CUES: 'decision-culture-cues',
  SCORING: 'scoring',
  UI_BLOCKS: 'ui-blocks',
} as const;

export type FeatureFlagName = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export const DEFAULT_FLAG_DESCRIPTIONS: Record<FeatureFlagName, string> = {
  [FEATURE_FLAGS.AGENTS]: 'Controls all agent execution (RINA, RUA, Outreach, retries).',
  [FEATURE_FLAGS.AGENTS_MATCHED_UI_V1]: 'Gates the matched agent UI surface.',
  [FEATURE_FLAGS.CONFIDENCE_ENABLED]: 'Gates confidence scoring surfaces and messaging.',
  [FEATURE_FLAGS.CLIENT_CONFIDENCE_SIGNAL]: 'Enables client-facing confidence statements on shortlist outputs.',
  [FEATURE_FLAGS.FIRE_DRILL_MODE]: 'Forces Fire Drill mode during incidents to reduce agent blast radius.',
  [FEATURE_FLAGS.JUDGMENT_MEMORY]: 'Enables admin-only institutional judgment memory insights (read-only).',
  [FEATURE_FLAGS.DECISION_MOMENT_CUES]: 'Shows inline cues when entering a decision moment and when outcomes sync to ATS providers.',
  [FEATURE_FLAGS.SOP_CONTEXTUAL_LINKS]: 'Shows contextual SOP links at key decision moments without blocking workflows.',
  [FEATURE_FLAGS.DECISION_CULTURE_CUES]: 'Shows anonymized cultural reinforcement callouts for recruiters based on recent decisions.',
  [FEATURE_FLAGS.SCORING]: 'Gates scoring and match computation flows.',
  [FEATURE_FLAGS.UI_BLOCKS]: 'Turns UI-only surfaces on or off.',
};

export const FEATURE_FLAG_ALIASES: Partial<Record<string, FeatureFlagName>> = {
  ete_confidence_enabled: FEATURE_FLAGS.CONFIDENCE_ENABLED,
  'client_confidence_signal': FEATURE_FLAGS.CLIENT_CONFIDENCE_SIGNAL,
};
