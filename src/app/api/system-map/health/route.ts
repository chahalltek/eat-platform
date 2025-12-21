import { NextResponse } from "next/server";

import {
  createDefaultNodeHealth,
  type HealthStatus,
  type NodeHealth,
  type SystemMapNodeId,
} from "@/app/system-map/opsImpact";
import { runHealthChecks } from "@/lib/health";
import { getSystemMode } from "@/lib/systemMode";
import type { SubsystemState } from "@/lib/systemStatus";
import { getSystemStatus } from "@/lib/systemStatus";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const statusPriority: HealthStatus[] = ["disabled", "fault", "waiting", "idle", "healthy"];

function getPriority(value: HealthStatus): number {
  const priority = statusPriority.indexOf(value);
  return priority === -1 ? statusPriority.length : priority;
}

function setNodeHealth(
  health: NodeHealth,
  node: SystemMapNodeId,
  next: { status: HealthStatus; message?: string; updatedAt?: string },
) {
  const current = health[node];

  if (!current || getPriority(next.status) <= getPriority(current.status)) {
    health[node] = {
      status: next.status,
      message: next.message ?? current?.message,
      updatedAt: next.updatedAt ?? current?.updatedAt,
    };
  }
}

function mapSubsystemStatus(status?: SubsystemState): HealthStatus {
  switch (status) {
    case "healthy":
      return "healthy";
    case "warning":
      return "waiting";
    case "error":
      return "fault";
    case "unknown":
    default:
      return "healthy";
  }
}

export async function GET() {
  const nodes = createDefaultNodeHealth();
  const timestamp = new Date().toISOString();

  try {
    const [systemStatus, mode, healthReport] = await Promise.all([
      getSystemStatus(),
      getSystemMode(),
      runHealthChecks().catch((error) => {
        console.error("[system-map-health] failed to collect health report", error);
        return null;
      }),
    ]);

    setNodeHealth(nodes, "database", {
      status: mapSubsystemStatus(systemStatus.database?.status),
      message: systemStatus.database?.detail,
      updatedAt: timestamp,
    });

    setNodeHealth(nodes, "scoring_engine", {
      status: mapSubsystemStatus(systemStatus.scoring?.status),
      message: systemStatus.scoring?.detail,
      updatedAt: timestamp,
    });

    setNodeHealth(nodes, "agent_sync_expand", {
      status: mapSubsystemStatus(systemStatus.agents?.status),
      message: systemStatus.agents?.detail,
      updatedAt: timestamp,
    });

    setNodeHealth(nodes, "feature_flags", {
      status: mapSubsystemStatus(systemStatus.guardrails?.status),
      message: systemStatus.guardrails?.detail,
      updatedAt: timestamp,
    });

    setNodeHealth(nodes, "tenant_config", {
      status: mapSubsystemStatus(systemStatus.tenantConfig?.status),
      message: systemStatus.tenantConfig?.detail,
      updatedAt: timestamp,
    });

    setNodeHealth(nodes, "diagnostics_audit", {
      status: mapSubsystemStatus(systemStatus.database?.status),
      message: systemStatus.database?.detail ?? "Observability depends on database availability",
      updatedAt: timestamp,
    });

    if (mode.mode === "fire_drill") {
      setNodeHealth(nodes, "runtime_controls", {
        status: "disabled",
        message: "Fire drill mode active",
        updatedAt: timestamp,
      });
    } else {
      setNodeHealth(nodes, "runtime_controls", {
        status: "healthy",
        message: "Runtime controls enabled",
        updatedAt: timestamp,
      });
    }

    if (healthReport) {
      healthReport.checks.forEach((check) => {
        if (check.name === "database") {
          setNodeHealth(nodes, "database", {
            status: check.status === "error" ? "fault" : check.status === "degraded" ? "waiting" : "healthy",
            message: check.message,
            updatedAt: timestamp,
          });
        }

        if (check.name === "openai") {
          setNodeHealth(nodes, "confidence_explain", {
            status: check.status === "error" ? "fault" : check.status === "degraded" ? "waiting" : "healthy",
            message: check.message,
            updatedAt: timestamp,
          });
        }

        if (check.name === "schema-drift") {
          setNodeHealth(nodes, "database", {
            status: check.status === "degraded" ? "waiting" : check.status === "error" ? "fault" : "healthy",
            message: check.message,
            updatedAt: timestamp,
          });
        }
      });
    }
  } catch (error) {
    console.error("[system-map-health] failed to gather system health", error);
  }

  return NextResponse.json(
    {
      nodes,
      timestamp,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
