import { getAppConfig } from "@/lib/config/configValidator";
import { FEATURE_FLAG_ALIASES, FEATURE_FLAGS, type FeatureFlagName } from "@/lib/featureFlags/constants";

export const DEPLOYMENT_MODES = {
  INTERNAL_STRSI: "internal_strsi",
  MANAGED_SERVICE: "managed_service",
  CUSTOMER_HOSTED: "customer_hosted",
  DEMO: "demo",
} as const;

export type DeploymentMode = (typeof DEPLOYMENT_MODES)[keyof typeof DEPLOYMENT_MODES];

const DEFAULT_DEPLOYMENT_MODE: DeploymentMode = DEPLOYMENT_MODES.INTERNAL_STRSI;

const DEPLOYMENT_FEATURE_FLAG_PRESETS: Record<DeploymentMode, Partial<Record<FeatureFlagName, boolean>>> = {
  [DEPLOYMENT_MODES.INTERNAL_STRSI]: {
    [FEATURE_FLAGS.UI_BLOCKS]: true,
    [FEATURE_FLAGS.AGENTS]: true,
    [FEATURE_FLAGS.SCORING]: true,
    [FEATURE_FLAGS.AGENTS_MATCHED_UI_V1]: true,
    [FEATURE_FLAGS.CONFIDENCE_ENABLED]: true,
  },
  [DEPLOYMENT_MODES.MANAGED_SERVICE]: {
    [FEATURE_FLAGS.UI_BLOCKS]: true,
    [FEATURE_FLAGS.AGENTS]: true,
    [FEATURE_FLAGS.SCORING]: true,
    [FEATURE_FLAGS.AGENTS_MATCHED_UI_V1]: true,
    [FEATURE_FLAGS.CONFIDENCE_ENABLED]: true,
  },
  [DEPLOYMENT_MODES.CUSTOMER_HOSTED]: {
    [FEATURE_FLAGS.UI_BLOCKS]: true,
    [FEATURE_FLAGS.SCORING]: true,
    [FEATURE_FLAGS.AGENTS]: false,
    [FEATURE_FLAGS.AGENTS_MATCHED_UI_V1]: false,
    [FEATURE_FLAGS.CONFIDENCE_ENABLED]: false,
  },
  [DEPLOYMENT_MODES.DEMO]: {
    [FEATURE_FLAGS.UI_BLOCKS]: true,
    [FEATURE_FLAGS.AGENTS]: false,
    [FEATURE_FLAGS.SCORING]: false,
    [FEATURE_FLAGS.AGENTS_MATCHED_UI_V1]: false,
    [FEATURE_FLAGS.CONFIDENCE_ENABLED]: false,
  },
};

function normalizeFeatureFlagName(value: string | undefined): FeatureFlagName | null {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) return null;

  const canonical = FEATURE_FLAG_ALIASES[normalized] ?? normalized;
  const supported = Object.values(FEATURE_FLAGS) as FeatureFlagName[];

  return (supported.find((flag) => flag === canonical) as FeatureFlagName | undefined) ?? null;
}

function parseBooleanFlagValue(raw: string | undefined, negated: boolean) {
  if (negated) return false;
  if (!raw) return true;

  return !["false", "0", "off", "disabled"].includes(raw.trim().toLowerCase());
}

export function parseFeatureFlagDefaults(raw: string | undefined) {
  if (!raw) return new Map<FeatureFlagName, boolean>();

  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  const parsed = tokens
    .map((token) => {
      const [namePart, rawValue] = token.split(/[:=]/, 2);
      const isNegated = namePart.startsWith("-");
      const flagName = normalizeFeatureFlagName(isNegated ? namePart.slice(1) : namePart);

      if (!flagName) return null;

      const enabled = parseBooleanFlagValue(rawValue, isNegated);

      return [flagName, enabled] as const;
    })
    .filter((entry): entry is readonly [FeatureFlagName, boolean] => Boolean(entry));

  return new Map(parsed);
}

export function getDeploymentMode(env: NodeJS.ProcessEnv = process.env): DeploymentMode {
  const config = getAppConfig(env);

  return config.DEPLOYMENT_MODE ?? DEFAULT_DEPLOYMENT_MODE;
}

export function getDeploymentFeatureFlagDefaults(env: NodeJS.ProcessEnv = process.env) {
  const config = getAppConfig(env);
  const deploymentMode = getDeploymentMode(env);
  const preset = DEPLOYMENT_FEATURE_FLAG_PRESETS[deploymentMode] ?? {};
  const manualOverrides = parseFeatureFlagDefaults(config.DEFAULT_FEATURE_FLAGS);

  return new Map<FeatureFlagName, boolean>([
    ...Object.entries(preset).map(([name, enabled]) => [name as FeatureFlagName, Boolean(enabled)]),
    ...manualOverrides,
  ]);
}
