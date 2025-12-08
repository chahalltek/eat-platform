export const KILL_SWITCHES = {
  AGENTS: "agents",
  SCORERS: "scorers",
  BUILDERS: "builders",
} as const;

type LatchedKillSwitchState = {
  latched: true;
  reason: string;
  latchedAt: Date;
};

type UnlatchedKillSwitchState = { latched: false };

export type KillSwitchState = LatchedKillSwitchState | UnlatchedKillSwitchState;
export type KillSwitchName = (typeof KILL_SWITCHES)[keyof typeof KILL_SWITCHES];

type KillSwitchContext = { componentName?: string };

type KillSwitchRegistry = Map<KillSwitchName, LatchedKillSwitchState>;

const killSwitchRegistry: KillSwitchRegistry = new Map();

const DEFAULT_REASON = "Manually latched";

function getEnvKey(name: KillSwitchName) {
  return `KILL_SWITCH_${name.toUpperCase()}`;
}

function normalizeReason(reason?: string | null) {
  const trimmed = reason?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_REASON;
}

function latchState(name: KillSwitchName, reason: string): LatchedKillSwitchState {
  const nextState: LatchedKillSwitchState = { latched: true, reason, latchedAt: new Date() };
  killSwitchRegistry.set(name, nextState);

  return nextState;
}

function readEnvLatch(name: KillSwitchName) {
  const envValue = process.env[getEnvKey(name)];

  if (!envValue) return null;

  return latchState(name, normalizeReason(envValue));
}

export function describeKillSwitch(name: KillSwitchName) {
  switch (name) {
    case KILL_SWITCHES.AGENTS:
      return "Agents";
    case KILL_SWITCHES.SCORERS:
      return "Scorers";
    case KILL_SWITCHES.BUILDERS:
      return "Builders";
    default:
      return name;
  }
}

export function getKillSwitchState(name: KillSwitchName): KillSwitchState {
  const latched = killSwitchRegistry.get(name);

  if (latched) return latched;

  const envLatched = readEnvLatch(name);

  if (envLatched) return envLatched;

  return { latched: false };
}

export function isKillSwitchLatched(name: KillSwitchName) {
  return getKillSwitchState(name).latched;
}

export class KillSwitchEngagedError extends Error {
  constructor(
    public readonly switchName: KillSwitchName,
    public readonly state: LatchedKillSwitchState,
    label?: string,
  ) {
    const componentLabel = label ?? describeKillSwitch(switchName);
    super(`${componentLabel} is disabled via kill switch: ${state.reason}`);
    this.name = "KillSwitchEngagedError";
  }
}

export function assertKillSwitchDisarmed(name: KillSwitchName, context: KillSwitchContext = {}) {
  const state = getKillSwitchState(name);

  if (!state.latched) return;

  const label = context.componentName ?? describeKillSwitch(name);

  throw new KillSwitchEngagedError(name, state, label);
}

export function latchKillSwitch(name: KillSwitchName, reason?: string) {
  return latchState(name, normalizeReason(reason));
}

export function resetKillSwitch(name: KillSwitchName) {
  killSwitchRegistry.delete(name);
}

export function resetAllKillSwitches() {
  killSwitchRegistry.clear();
}
