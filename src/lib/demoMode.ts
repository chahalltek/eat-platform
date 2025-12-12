import type { SystemExecutionState, SystemStatusMap } from "./systemStatus";
import type { SystemMode } from "./systemMode";

const DEMO_FLAG = "ETE_PUBLIC_DEMO";
const DEMO_MUTATION_ALLOWLIST = ["/api/auth/login", "/api/auth/logout"] as const;

const redactedMode: SystemMode = {
  mode: "pilot",
  metadata: {},
  guardrailsPreset: "demo-safe",
  agentEnablement: { basic: true, shortlist: true, agents: false },
};

const redactedStatusMap: SystemStatusMap = {
  agents: { status: "healthy" },
  scoring: { status: "healthy" },
  database: { status: "healthy" },
  guardrails: { status: "healthy" },
  tenantConfig: { status: "healthy" },
};

export function isPublicDemoMode() {
  return (process.env[DEMO_FLAG] ?? "").toLowerCase() === "true";
}

export function isReadOnlyHttpMethod(method: string) {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export function isDemoMutationAllowed(pathname: string) {
  return (DEMO_MUTATION_ALLOWLIST as readonly string[]).some((path) => pathname === path);
}

export function getRedactedSystemStatus(): SystemStatusMap {
  return redactedStatusMap;
}

export function getRedactedExecutionState(): SystemExecutionState {
  return {
    state: "operational",
    mode: redactedMode,
    activeRuns: 0,
    latestRunAt: null,
    latestSuccessAt: null,
    latestFailureAt: null,
    runsToday: 0,
    latestFailureAgentName: null,
    failureCountLast24h: 0,
  };
}
