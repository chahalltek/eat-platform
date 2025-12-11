"use client";

import { useMemo, useState } from "react";

export type AgentKillSwitchRow = {
  agentName: string;
  agentLabel: string;
  latched: boolean;
  latchedAt: string | null;
  updatedAt: string;
};

async function toggleKillSwitch(agentName: string, latched: boolean) {
  const response = await fetch("/api/admin/agents/kill-switch", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentName, latched }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload.error === "string" ? payload.error : "Unable to update kill switch";
    throw new Error(message);
  }

  return response.json();
}

export function KillSwitchTable({ initialRows }: { initialRows: AgentKillSwitchRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => a.agentName.localeCompare(b.agentName));
  }, [rows]);

  async function handleToggle(row: AgentKillSwitchRow) {
    setPendingName(row.agentName);
    setError(null);

    const nextLatched = !row.latched;

    setRows((prev) =>
      prev.map((item) =>
        item.agentName === row.agentName
          ? { ...item, latched: nextLatched, latchedAt: nextLatched ? new Date().toISOString() : null }
          : item,
      ),
    );

    try {
      const updated = await toggleKillSwitch(row.agentName, nextLatched);

      setRows((prev) =>
        prev.map((item) => (item.agentName === updated.agentName ? { ...item, ...updated } : item)),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update kill switch";
      setError(message);
      setRows((prev) => prev.map((item) => (item.agentName === row.agentName ? row : item)));
    } finally {
      setPendingName(null);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-zinc-900">Agent kill switches</h2>
        <p className="text-sm text-zinc-600">Temporarily disable specific agents at runtime.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-zinc-200">
        <table className="min-w-full divide-y divide-zinc-200">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">Agent</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">Last updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {sortedRows.map((row) => {
              const isPending = pendingName === row.agentName;
              const statusLabel = row.latched ? "Disabled" : "Active";
              const statusColor = row.latched
                ? "bg-rose-100 text-rose-700"
                : "bg-emerald-100 text-emerald-700";

              return (
                <tr key={row.agentName}>
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900">{row.agentLabel}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
                      {statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700">
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleToggle(row)}
                      disabled={isPending}
                      className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition ${
                        row.latched
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                          : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300'
                      } ${isPending ? 'opacity-60' : ''}`}
                    >
                      {isPending ? 'Saving…' : row.latched ? 'Enable' : 'Disable'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
