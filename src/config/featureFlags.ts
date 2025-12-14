export const SECURITY_MODES = {
  PREVIEW: "preview",
  INTERNAL: "internal",
} as const;

export type SecurityMode = (typeof SECURITY_MODES)[keyof typeof SECURITY_MODES];

export const HARD_FEATURE_FLAGS = {
  EXECUTION_ENABLED: "EXECUTION_ENABLED",
  OUTBOUND_EMAIL_ENABLED: "OUTBOUND_EMAIL_ENABLED",
  BULK_ACTIONS_ENABLED: "BULK_ACTIONS_ENABLED",
  REAL_ATS_WRITEBACK_ENABLED: "REAL_ATS_WRITEBACK_ENABLED",
  DATA_EXPORTS_ENABLED: "DATA_EXPORTS_ENABLED",
} as const;

export type HardFeatureFlag = (typeof HARD_FEATURE_FLAGS)[keyof typeof HARD_FEATURE_FLAGS];

const FLAG_DESCRIPTIONS: Record<HardFeatureFlag, string> = {
  [HARD_FEATURE_FLAGS.EXECUTION_ENABLED]: "Execution",
  [HARD_FEATURE_FLAGS.OUTBOUND_EMAIL_ENABLED]: "Outbound email",
  [HARD_FEATURE_FLAGS.BULK_ACTIONS_ENABLED]: "Bulk actions",
  [HARD_FEATURE_FLAGS.REAL_ATS_WRITEBACK_ENABLED]: "ATS writeback",
  [HARD_FEATURE_FLAGS.DATA_EXPORTS_ENABLED]: "Data exports",
};

const DEFAULT_FLAG_VALUE_BY_MODE: Record<SecurityMode, boolean> = {
  [SECURITY_MODES.PREVIEW]: false,
  [SECURITY_MODES.INTERNAL]: false,
};

function normalizeBoolean(value: string | undefined): boolean | null {
  if (value == null) return null;

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;

  return null;
}

export function getSecurityMode(env: NodeJS.ProcessEnv = process.env): SecurityMode {
  const rawMode = env.SECURITY_MODE?.trim().toLowerCase();

  if (rawMode === SECURITY_MODES.INTERNAL) return SECURITY_MODES.INTERNAL;

  return SECURITY_MODES.PREVIEW;
}

export function isHardFeatureEnabled(
  flagName: HardFeatureFlag,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const explicitOverride = normalizeBoolean(env[flagName]);

  if (explicitOverride != null) {
    return explicitOverride;
  }

  const securityMode = getSecurityMode(env);

  return DEFAULT_FLAG_VALUE_BY_MODE[securityMode];
}

export class FeatureDisabledError extends Error {
  constructor(public flagName: HardFeatureFlag, public securityMode: SecurityMode) {
    super(`${FLAG_DESCRIPTIONS[flagName]} is disabled in ${securityMode} mode`);
    this.name = "FeatureDisabledError";
  }
}

export function assertFeatureEnabled(
  flagName: HardFeatureFlag,
  env: NodeJS.ProcessEnv = process.env,
): asserts env is NodeJS.ProcessEnv {
  const securityMode = getSecurityMode(env);

  if (!isHardFeatureEnabled(flagName, env)) {
    throw new FeatureDisabledError(flagName, securityMode);
  }
}

