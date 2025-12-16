import { describeKillSwitch, getKillSwitchState, KILL_SWITCHES, type KillSwitchName, type KillSwitchState } from "@/lib/killSwitch";
import { listFeatureFlags, type FeatureFlagRecord } from "@/lib/featureFlags";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { type SystemModeName } from "@/lib/modes/systemModes";
import { withTenantContext } from "@/lib/tenant";

export type RuntimeControlStatus = "enabled" | "disabled" | "blocked";

export type RuntimeControlScope = "tenant" | "global" | "environment";

export type RuntimeControlSource = "runtime" | "environment" | "plan" | "default" | "fallback";

export type RuntimeControlDescriptor = {
  id: string;
  label: string;
  description: string | null;
  scope: RuntimeControlScope;
  source: RuntimeControlSource;
  status: RuntimeControlStatus;
  reason: string | null;
  updatedAt: string | null;
};

export type RuntimeControlsContract = {
  tenantId: string;
  generatedAt: string;
  mode: {
    name: SystemModeName;
    guardrailsPreset: string;
    agentsEnabled: string[];
    source: "database" | "fallback";
  };
  controls: {
    safety: RuntimeControlDescriptor[];
    killSwitches: RuntimeControlDescriptor[];
    featureFlags: RuntimeControlDescriptor[];
  };
};

const SAFETY_KEYS = {
  TESTS_DISABLED: "tests-disabled",
  HOSTING_ON_VERCEL: "hosting-on-vercel",
} as const;

function killSwitchEnvKey(name: KillSwitchName) {
  return `KILL_SWITCH_${name.toUpperCase()}`;
}

export function describeSafetyControls(env: NodeJS.ProcessEnv = process.env): RuntimeControlDescriptor[] {
  const testsDisabled =
    env.TESTS_DISABLED_IN_THIS_ENVIRONMENT === "true" || env.testsDisabledInThisEnvironment === "true";
  const hostingOnVercel = env.HOSTING_ON_VERCEL === "true" || env["hosting-on-vercel"] === "true" || env.VERCEL === "1";

  const safetyControls: RuntimeControlDescriptor[] = [];

  safetyControls.push({
    id: `safety.${SAFETY_KEYS.TESTS_DISABLED}`,
    label: "Test and mutation APIs",
    description: "Protects the platform when mutations are not allowed in this environment.",
    scope: "environment",
    source: "environment",
    status: testsDisabled ? "blocked" : "enabled",
    reason: testsDisabled ? "Test and mutation APIs are disabled in this environment." : null,
    updatedAt: null,
  });

  safetyControls.push({
    id: `safety.${SAFETY_KEYS.HOSTING_ON_VERCEL}`,
    label: "Hosting mode",
    description: "Prevents mutating operations when running on Vercel-hosted deployments.",
    scope: "environment",
    source: "environment",
    status: hostingOnVercel ? "blocked" : "enabled",
    reason: hostingOnVercel ? "Mutations are disabled while hosting on Vercel." : null,
    updatedAt: null,
  });

  return safetyControls;
}

export function mapKillSwitchControl(
  name: KillSwitchName,
  state: KillSwitchState,
  env: NodeJS.ProcessEnv = process.env,
): RuntimeControlDescriptor {
  const latchedByEnv = Boolean(env[killSwitchEnvKey(name)]);
  const status: RuntimeControlStatus = state.latched ? "disabled" : "enabled";

  return {
    id: `kill.${name}`,
    label: describeKillSwitch(name),
    description: "Emergency latch that halts the component when engaged.",
    scope: latchedByEnv ? "environment" : "global",
    source: latchedByEnv ? "environment" : "runtime",
    status,
    reason: state.latched ? state.reason : null,
    updatedAt: state.latched ? state.latchedAt.toISOString() : null,
  };
}

export function mapFeatureFlagControl(record: FeatureFlagRecord): RuntimeControlDescriptor {
  const hasOverride = record.updatedAt.getTime() > 0;
  const source: RuntimeControlSource = hasOverride ? "plan" : "default";

  return {
    id: `flag.${record.name}`,
    label: record.name,
    description: record.description ?? null,
    scope: "tenant",
    source,
    status: record.enabled ? "enabled" : "disabled",
    reason: record.enabled ? null : "Feature is disabled for this tenant.",
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function buildRuntimeControlsContract(
  tenantId: string,
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<RuntimeControlsContract> {
  const env = options.env ?? process.env;
  const [mode, featureFlags] = await Promise.all([
    loadTenantMode(tenantId),
    withTenantContext(tenantId, () => listFeatureFlags()),
  ]);

  const killSwitches = (Object.values(KILL_SWITCHES) as KillSwitchName[]).map((name) =>
    mapKillSwitchControl(name, getKillSwitchState(name), env),
  );

  return {
    tenantId,
    generatedAt: new Date().toISOString(),
    mode: {
      name: mode.mode,
      guardrailsPreset: mode.guardrailsPreset,
      agentsEnabled: mode.agentsEnabled,
      source: mode.source,
    },
    controls: {
      safety: describeSafetyControls(env),
      killSwitches,
      featureFlags: featureFlags.map(mapFeatureFlagControl),
    },
  } satisfies RuntimeControlsContract;
}
