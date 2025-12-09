import { getAgentKillSwitchState, parseAgentName } from "@/lib/agents/killSwitch";

export async function isAgentDisabled(agentName: string): Promise<boolean> {
  const parsedName = parseAgentName(agentName);

  if (!parsedName) return false;

  const state = await getAgentKillSwitchState(parsedName);

  return state.latched;
}
