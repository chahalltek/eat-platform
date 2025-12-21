export type SystemMapNodeId =
  | "intake"
  | "ats_adapter_sync"
  | "rua"
  | "rina"
  | "database"
  | "scoring_engine"
  | "confidence_explain"
  | "agent_sync_expand"
  | "diagnostics_audit"
  | "tenant_config"
  | "feature_flags"
  | "runtime_controls";

export const SYSTEM_MAP_NODE_IDS: readonly SystemMapNodeId[] = [
  "intake",
  "ats_adapter_sync",
  "rua",
  "rina",
  "database",
  "scoring_engine",
  "confidence_explain",
  "agent_sync_expand",
  "diagnostics_audit",
  "tenant_config",
  "feature_flags",
  "runtime_controls",
] as const;

export type HealthStatus = "healthy" | "idle" | "waiting" | "fault" | "disabled";

export type NodeHealth = Record<
  SystemMapNodeId,
  {
    status: HealthStatus;
    message?: string;
    updatedAt?: string;
  }
>;

export type ImpactClass = "halts" | "fails_closed" | "blocks" | "degrades" | "isolated";

export type SystemMapHealthResponse = {
  nodes: NodeHealth;
  timestamp?: string;
};

export type SystemMapNode = {
  id: SystemMapNodeId;
  name: string;
  type: string;
  summary: string;
  tags: string[];
  impact: ImpactClass;
};

export const IMPACT_CLASS_ORDER: ImpactClass[] = ["halts", "fails_closed", "blocks", "degrades", "isolated"];

const HEALTH_STATUS_VALUES = new Set<HealthStatus>(["healthy", "idle", "waiting", "fault", "disabled"]);

export function createDefaultNodeHealth(): NodeHealth {
  return SYSTEM_MAP_NODE_IDS.reduce((acc, id) => {
    acc[id] = { status: "healthy" };
    return acc;
  }, {} as NodeHealth);
}

function isSystemMapNodeId(value: unknown): value is SystemMapNodeId {
  return typeof value === "string" && (SYSTEM_MAP_NODE_IDS as readonly string[]).includes(value);
}

function isHealthStatus(value: unknown): value is HealthStatus {
  return typeof value === "string" && HEALTH_STATUS_VALUES.has(value as HealthStatus);
}

export function normalizeNodeHealthResponse(input: unknown): NodeHealth {
  const baseline = createDefaultNodeHealth();

  if (!input || typeof input !== "object") {
    return baseline;
  }

  const payload = (input as SystemMapHealthResponse).nodes ?? input;
  const fallbackUpdatedAt =
    typeof (input as SystemMapHealthResponse).timestamp === "string" ? (input as SystemMapHealthResponse).timestamp : undefined;

  if (!payload || typeof payload !== "object") {
    return baseline;
  }

  for (const [key, value] of Object.entries(payload)) {
    if (!isSystemMapNodeId(key) || !value || typeof value !== "object") continue;

    const candidateStatus = (value as { status?: unknown }).status;

    if (!isHealthStatus(candidateStatus)) continue;

    const message = typeof (value as { message?: unknown }).message === "string" ? (value as { message?: string }).message : undefined;
    const updatedAt =
      typeof (value as { updatedAt?: unknown }).updatedAt === "string"
        ? (value as { updatedAt?: string }).updatedAt
        : fallbackUpdatedAt;

    baseline[key] = {
      status: candidateStatus,
      message,
      updatedAt,
    };
  }

  return baseline;
}

export function resolveSeverity(impact: ImpactClass): "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4" {
  switch (impact) {
    case "halts":
    case "fails_closed":
      return "SEV-1";
    case "blocks":
      return "SEV-2";
    case "degrades":
      return "SEV-3";
    case "isolated":
    default:
      return "SEV-4";
  }
}
