import type { SystemModeName } from "@/lib/modes/systemModes";

export type SubsystemKey = "agents" | "scoring" | "database" | "tenantConfig" | "guardrails";
export type SubsystemState = "healthy" | "warning" | "error" | "unknown";

export type SystemExecutionState = {
  state: "operational" | "idle" | "degraded";
  mode: SystemModeName;
  activeRuns: number;
  latestRunAt: string | null;
  latestSuccessAt: string | null;
  latestFailureAt: string | null;
  runsToday: number;
  latestFailureAgentName: string | null;
  failureCountLast24h: number;
};

export type SystemStatus = { status: SubsystemState; detail?: string };
export type SystemStatusMap = Record<SubsystemKey, SystemStatus>;
