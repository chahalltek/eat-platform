"use client";

import { useState } from "react";

import { SystemStateBanner } from "@/components/SystemStateBanner";
import { SystemStatus } from "@/components/SystemStatus";
import type { SystemExecutionState, SystemStatusMap } from "@/lib/systemStatus";

type Props = {
  initialStatus: SystemStatusMap;
  initialExecutionState: SystemExecutionState;
  canResetDegraded: boolean;
};

export function SystemHealthPanel({ initialStatus, initialExecutionState, canResetDegraded }: Props) {
  const [statusMap, setStatusMap] = useState<SystemStatusMap>(initialStatus);
  const [executionState, setExecutionState] = useState<SystemExecutionState>(initialExecutionState);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  async function handleRefresh() {
    try {
      setIsRefreshing(true);
      const response = await fetch("/api/system-state", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Failed to refresh status");
      }

      const data = (await response.json()) as {
        statusMap: SystemStatusMap;
        executionState: SystemExecutionState;
      };

      setStatusMap(data.statusMap);
      setExecutionState(data.executionState);
    } catch (error) {
      console.error("[system-health] refresh failed", error);
      setStatusMap({
        agents: { status: "unknown" },
        scoring: { status: "unknown" },
        database: { status: "unknown" },
        guardrails: { status: "unknown" },
        tenantConfig: { status: "unknown" },
      });
      setExecutionState((current) => ({
        ...current,
        state: "degraded",
        activeRuns: 0,
        latestRunAt: null,
        latestSuccessAt: null,
        latestFailureAt: null,
        runsToday: 0,
        latestFailureAgentName: null,
        failureCountLast24h: 0,
      }));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleReset() {
    if (!canResetDegraded) return;

    try {
      setIsResetting(true);
      const response = await fetch("/api/system-state/reset", { method: "POST", cache: "no-store" });

      if (!response.ok) {
        throw new Error("Failed to reset execution state");
      }

      const data = (await response.json()) as {
        statusMap: SystemStatusMap;
        executionState: SystemExecutionState;
      };

      setStatusMap(data.statusMap);
      setExecutionState(data.executionState);
    } catch (error) {
      console.error("[system-health] reset failed", error);
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="space-y-3">
      <SystemStateBanner
        executionState={executionState}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        canResetDegraded={canResetDegraded}
        onReset={handleReset}
        isResetting={isResetting}
      />
      <SystemStatus
        statusMap={statusMap}
        executionState={executionState}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}
