"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type AgentRunStatusValue = "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL";

export type SerializableLog = {
  id: string;
  agentName: string;
  startedAt: string;
  status: AgentRunStatusValue;
  userLabel: string;
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  errorMessage?: string | null;
  retryCount: number;
  retryOfId?: string | null;
};

const STATUS_LABELS: Record<AgentRunStatusValue, { label: string; tone: "success" | "error" | "info" | "warning" }> = {
  RUNNING: { label: "Running", tone: "info" },
  SUCCESS: { label: "Success", tone: "success" },
  FAILED: { label: "Failed", tone: "error" },
  PARTIAL: { label: "Partial", tone: "warning" },
};

function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString();
}

function summarizeInput(input: unknown) {
  if (input === null || input === undefined) return "—";

  const rawSummary = typeof input === "string" ? input : JSON.stringify(input);
  if (!rawSummary) return "—";

  return rawSummary.length > 120 ? `${rawSummary.slice(0, 117)}...` : rawSummary;
}

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
          <p className="text-sm text-gray-500">Started {formatDateTime(log.startedAt)}</p>
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
            {log.errorMessage ?? "Unknown error"}
          </div>
        </div>
      )}

      {retryError ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{retryError}</div>
      ) : null}
    </div>
  );
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

function LogsTable({
  logs,
  selectedId,
  onSelect,
}: {
  logs: SerializableLog[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-left text-sm text-gray-700">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold text-gray-900">
              Agent
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-gray-900">
              User
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-gray-900">
              Timestamp
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-gray-900">
              Input summary
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-gray-900">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.map((log) => (
            <tr
              key={log.id}
              className={clsx("cursor-pointer transition-colors hover:bg-gray-50", {
                "bg-blue-50": log.id === selectedId,
              })}
              onClick={() => onSelect(log.id)}
            >
              <td className="px-4 py-3 font-medium text-gray-900">{log.agentName}</td>
              <td className="px-4 py-3">{log.userLabel}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(log.startedAt)}</td>
              <td className="px-4 py-3 text-gray-600">{summarizeInput(log.inputSnapshot)}</td>
              <td className="px-4 py-3">
                <StatusPill status={log.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AgentRunLogsView({ logs }: { logs: SerializableLog[] }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(logs[0]?.id);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const router = useRouter();

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
        <LogsTable logs={logs} selectedId={selectedId} onSelect={setSelectedId} />
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
