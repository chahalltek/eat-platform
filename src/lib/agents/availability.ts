import { isFeatureEnabledForTenant } from "@/lib/featureFlags";
import { FEATURE_FLAGS } from "@/lib/featureFlags/constants";
import { getCurrentTenantId } from "@/lib/tenant";
import { getSystemMode, type SystemMode } from "@/lib/systemMode";

export type AgentAvailability = {
  mode: SystemMode;
  confidenceEnabled: boolean;
  explainEnabled: boolean;
  shortlistEnabled: boolean;
};

export class FireDrillAgentDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FireDrillAgentDisabledError";
  }
}

export async function getAgentAvailability(): Promise<AgentAvailability> {
  const [systemMode, tenantId] = await Promise.all([getSystemMode(), getCurrentTenantId()]);
  const fireDrillEnabled = await isFeatureEnabledForTenant(tenantId, FEATURE_FLAGS.FIRE_DRILL_MODE);

  if (fireDrillEnabled) {
    return {
      mode: {
        ...systemMode,
        mode: "fire_drill",
        guardrailsPreset: "conservative",
        agentEnablement: { basic: false, shortlist: false, agents: false },
      },
      confidenceEnabled: false,
      explainEnabled: false,
      shortlistEnabled: false,
    } satisfies AgentAvailability;
  }

  const killSwitches: Array<{ latched: boolean }> = [];
  const hasLatchedKillSwitch = killSwitches.some((entry) => entry.latched);

  // Any latched kill switch should override the per-agent flags for
  // non-essential agents so we fail safely.
  if (hasLatchedKillSwitch) {
    return {
      mode: systemMode,
      confidenceEnabled: false,
      explainEnabled: false,
      shortlistEnabled: false,
    } satisfies AgentAvailability;
  }

  return {
    mode: systemMode,
    confidenceEnabled: systemMode.agentEnablement.basic,
    explainEnabled: systemMode.agentEnablement.basic,
    shortlistEnabled: systemMode.agentEnablement.shortlist,
  } satisfies AgentAvailability;
}

export async function assertAgentEnabled<T extends keyof AgentAvailability & string>(
  agentKey: Extract<T, "confidenceEnabled" | "explainEnabled" | "shortlistEnabled">,
  message: string,
) {
  const availability = await getAgentAvailability();

  if (!availability[agentKey]) {
    throw new FireDrillAgentDisabledError(message);
  }

  return availability;
}
