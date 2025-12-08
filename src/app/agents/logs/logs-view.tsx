"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";

export type AgentRunStatusValue = "RUNNING" | "SUCCESS" | "ERROR";

export type SerializableLog = {
  id: string;
  agentName: string;
  startedAt: string;
  status: AgentRunStatusValue;
  userLabel: string;
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  errorMessage?: string | null;
};

const STATUS_LABELS: Record<AgentRunStatusValue, { label: string; tone: "success" | "error" | "info" }> = {
  RUNNING: { label: "Running", tone: "info" },
  SUCCESS: { label: "Success", tone: "success" },
  ERROR: { label: "Failed", tone: "error" },
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

function LogDetail({ log }: { log: SerializableLog | undefined }) {
  if (!log) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Select a run to see details.
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Run Details</h2>
        <p className="text-sm text-gray-500">Started {formatDateTime(log.startedAt)}</p>
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

      {log.status === "ERROR" && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">Error</h3>
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
            {log.errorMessage ?? "Unknown error"}
          </div>
        </div>
      )}
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

  const selectedLog = useMemo(() => logs.find((log) => log.id === selectedId), [logs, selectedId]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <LogsTable logs={logs} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <div className="lg:col-span-1">
        <LogDetail log={selectedLog} />
      </div>
    </div>
  );
}
