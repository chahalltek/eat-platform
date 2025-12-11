import { listAgentKillSwitches } from "@/lib/agents/killSwitch";
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
  const mode = getSystemMode();

  // In Fire Drill we intentionally hard-disable anything that relies on LLMs
  // or non-essential scoring.
  if (mode === "FIRE_DRILL") {
    return {
      mode,
      confidenceEnabled: false,
      explainEnabled: false,
      shortlistEnabled: false,
    } satisfies AgentAvailability;
  }

  const killSwitches = await listAgentKillSwitches();
  const hasLatchedKillSwitch = killSwitches.some((entry) => entry.latched);

  // Any latched kill switch should override the per-agent flags for
  // non-essential agents so we fail safely.
  if (hasLatchedKillSwitch) {
    return {
      mode,
      confidenceEnabled: false,
      explainEnabled: false,
      shortlistEnabled: false,
    } satisfies AgentAvailability;
  }

  return {
    mode,
    confidenceEnabled: true,
    explainEnabled: true,
    shortlistEnabled: true,
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
