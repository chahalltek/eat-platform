"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnFiltersState } from "@tanstack/react-table";
import clsx from "clsx";

import { AgentRunLogsTable, formatDurationMs, formatTimestamp } from "./agent-run-logs-table";
import type { AgentRunStatusValue, SerializableLog } from "./types";

const STATUS_LABELS: Record<AgentRunStatusValue, { label: string; tone: "success" | "error" | "info" | "warning" }> = {
  RUNNING: { label: "Running", tone: "info" },
  SUCCESS: { label: "Success", tone: "success" },
  FAILED: { label: "Failed", tone: "error" },
  PARTIAL: { label: "Partial", tone: "warning" },
};

const ERROR_CATEGORY_LABELS = {
  AI: "AI failure",
  DATA: "Data failure",
  AUTH: "Auth failure",
} as const;

function LogDetail({
  log,
  onRetry,
  retrying,
  retryError,
}: {
  log: SerializableLog | undefined;
  onRetry?: (log: SerializableLog) => void;
  retrying: boolean;
  retryError: string | null;
}) {
  if (!log) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Select a run to see details.
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Run Details</h2>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">Started {formatTimestamp(log.startedAt)}</p>
          {onRetry ? (
            <button
              type="button"
              className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500"
              onClick={() => log && onRetry(log)}
              disabled={retrying || log.status === "RUNNING"}
            >
              {retrying ? "Retrying..." : "Retry run"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Agent</div>
          <div className="text-lg font-semibold text-gray-900">{log.agentName}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">User</div>
          <div className="text-lg font-semibold text-gray-900">{log.userLabel}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Status</div>
          <StatusPill status={log.status} />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Error type</div>
          <ErrorCategoryBadge category={log.errorCategory} />
        </div>
        {log.durationMs ? (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Duration</div>
            <div className="text-lg font-semibold text-gray-900">{formatDurationMs(log.durationMs)}</div>
          </div>
        ) : null}
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Retry count</div>
          <div className="text-lg font-semibold text-gray-900">{log.retryCount ?? 0}</div>
        </div>
        {log.retryOfId ? (
          <div className="sm:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Retry of</div>
            <div className="text-sm font-semibold text-gray-900">{log.retryOfId}</div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">Full Prompt</h3>
        <pre className="overflow-x-auto rounded-lg bg-gray-100 p-4 text-sm text-gray-800">
          {JSON.stringify(log.inputSnapshot, null, 2)}
        </pre>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">Result</h3>
        <pre className="overflow-x-auto rounded-lg bg-gray-100 p-4 text-sm text-gray-800">
          {JSON.stringify(log.outputSnapshot ?? "—", null, 2)}
        </pre>
      </div>

      {log.status === "FAILED" && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">Error</h3>
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
            {log.errorMessage ?? "Error details unavailable"}
          </div>
        </div>
      )}

      {retryError ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{retryError}</div>
      ) : null}
    </div>
  );
}

function ErrorCategoryBadge({ category }: { category: SerializableLog["errorCategory"] }) {
  if (!category) return <span className="text-slate-400">—</span>;

  const label = ERROR_CATEGORY_LABELS[category];
  const styles: Record<typeof category, string> = {
    AI: "bg-blue-100 text-blue-800",
    DATA: "bg-amber-100 text-amber-800",
    AUTH: "bg-red-100 text-red-800",
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[category]}`}>{label}</span>;
}

function StatusPill({ status }: { status: AgentRunStatusValue }) {
  const tone = STATUS_LABELS[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        {
          "bg-green-100 text-green-800": tone.tone === "success",
          "bg-red-100 text-red-800": tone.tone === "error",
          "bg-blue-100 text-blue-800": tone.tone === "info",
          "bg-amber-100 text-amber-800": tone.tone === "warning",
        },
      )}
    >
      {tone.label}
    </span>
  );
}

export default function AgentRunLogsView({
  logs,
  initialAgentFilter,
}: {
  logs: SerializableLog[];
  initialAgentFilter?: string;
}) {
  const defaultSelectedId = useMemo(() => {
    if (initialAgentFilter) {
      const match = logs.find((log) => log.agentName === initialAgentFilter);
      if (match) return match.id;
    }
    return logs[0]?.id;
  }, [initialAgentFilter, logs]);

  const [selectedId, setSelectedId] = useState<string | undefined>(defaultSelectedId);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const router = useRouter();

  const initialColumnFilters = useMemo<ColumnFiltersState>(() => {
    if (!initialAgentFilter) return [];
    return [{ id: "agentName", value: [initialAgentFilter] }];
  }, [initialAgentFilter]);

  const selectedLog = useMemo(() => logs.find((log) => log.id === selectedId), [logs, selectedId]);

  useEffect(() => {
    setRetryError(null);
  }, [selectedId]);

  const handleRetry = useCallback(
    async (log: SerializableLog) => {
      setRetryError(null);
      setRetryingId(log.id);

      try {
        const response = await fetch(`/api/agents/runs/${log.id}/retry`, { method: "POST" });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload?.error || "Failed to retry run");
        }

        router.refresh();
      } catch (err) {
        setRetryError(err instanceof Error ? err.message : "Failed to retry run");
      } finally {
        setRetryingId(null);
      }
    },
    [router],
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <AgentRunLogsTable
          logs={logs}
          selectedId={selectedId}
          onSelect={setSelectedId}
          initialColumnFilters={initialColumnFilters}
        />
      </div>
      <div className="lg:col-span-1">
        <LogDetail
          log={selectedLog}
          onRetry={handleRetry}
          retrying={retryingId === selectedLog?.id}
          retryError={retryError}
        />
      </div>
    </div>
  );
}
