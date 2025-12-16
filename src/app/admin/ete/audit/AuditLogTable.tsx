"use client";

import { useEffect, useMemo, useState } from "react";

import { CodePill } from "@/components/CodePill";
import { MonoText } from "@/components/MonoText";
import { ADMIN_AUDIT_ACTIONS, type AdminAuditAction } from "@/lib/audit/adminAudit";

export type AuditLogRow = {
  id: string;
  tenantId: string;
  action: AdminAuditAction;
  actorId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

const ACTION_LABELS: Record<AdminAuditAction, string> = {
  [ADMIN_AUDIT_ACTIONS.MODE_CHANGED]: "Mode changed",
  [ADMIN_AUDIT_ACTIONS.GUARDRAILS_UPDATED]: "Guardrails updated",
  [ADMIN_AUDIT_ACTIONS.AGENT_FLAG_TOGGLED]: "Agent flag toggled",
  [ADMIN_AUDIT_ACTIONS.KILL_SWITCH_TOGGLED]: "Kill switch toggled",
};

function formatMeta(row: AuditLogRow) {
  const meta = row.meta ?? {};

  if (row.action === ADMIN_AUDIT_ACTIONS.MODE_CHANGED) {
    const from = typeof meta.previousMode === "string" ? meta.previousMode : "unknown";
    const to = typeof meta.newMode === "string" ? meta.newMode : "unknown";
    return `Mode: ${from} → ${to}`;
  }

  if (row.action === ADMIN_AUDIT_ACTIONS.GUARDRAILS_UPDATED) {
    const preset = typeof meta.preset === "string" ? meta.preset : "custom";
    const strategy = typeof meta.scoringStrategy === "string" ? meta.scoringStrategy : "weighted";
    return `Guardrails preset ${preset}, strategy ${strategy}`;
  }

  if (row.action === ADMIN_AUDIT_ACTIONS.AGENT_FLAG_TOGGLED) {
    const agent = typeof meta.agentName === "string" ? meta.agentName : "agent";
    const latched = meta.latched === true ? "disabled" : "enabled";
    return `${agent} ${latched}`;
  }

  if (row.action === ADMIN_AUDIT_ACTIONS.KILL_SWITCH_TOGGLED) {
    const key = typeof meta.key === "string" ? meta.key : "kill switch";
    const latched = meta.latched === true ? "latched" : "unlatched";
    const reason = typeof meta.reason === "string" && meta.reason.trim().length > 0 ? meta.reason : "no reason";
    return `${key} ${latched}${meta.latched === true ? ` (${reason})` : ""}`;
  }

  return "—";
}

function toDateInputValue(value: string) {
  const [date] = value.split("T");
  return date;
}

export function AuditLogTable({ initialEntries, tenantId }: { initialEntries: AuditLogRow[]; tenantId: string }) {
  const [entries, setEntries] = useState(initialEntries);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [sinceDate, setSinceDate] = useState<string>("");
  const [actorFilter, setActorFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [entries]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchEntries = async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ tenantId, limit: "200" });
      if (actionFilter) params.set("action", actionFilter);
      if (actorFilter.trim()) params.set("actorId", actorFilter.trim());
      if (sinceDate) {
        const parsedDate = new Date(`${sinceDate}T00:00:00Z`);
        if (!Number.isNaN(parsedDate.getTime())) {
          params.set("since", parsedDate.toISOString());
        }
      }

      try {
        const response = await fetch(`/api/admin/ete/audit?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const message = typeof body.error === "string" ? body.error : "Unable to load audit logs";
          throw new Error(message);
        }

        const payload = (await response.json()) as { entries?: AuditLogRow[] };
        if (payload.entries) {
          setEntries(payload.entries);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load audit logs");
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();

    return () => controller.abort();
  }, [actionFilter, actorFilter, sinceDate, tenantId]);

  return (
    <div className="space-y-4 rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm dark:border-indigo-900/60 dark:bg-zinc-950/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Audit activity</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Track admin changes to system mode, guardrails, and agent kill switches for tenant{" "}
            <MonoText className="text-sm text-indigo-800 dark:text-indigo-200">{tenantId}</MonoText>.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {loading ? (
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-100">
              Refreshing…
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm shadow-inner dark:border-indigo-900/60 dark:bg-zinc-900/50">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
            Action
            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-indigo-800 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="">All actions</option>
              {Object.values(ADMIN_AUDIT_ACTIONS).map((action) => (
                <option key={action} value={action}>
                  {ACTION_LABELS[action]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
            Actor ID
            <input
              type="text"
              value={actorFilter}
              onChange={(event) => setActorFilter(event.target.value)}
              placeholder="user-123"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-indigo-800 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
            Since date
            <input
              type="date"
              value={sinceDate}
              max={toDateInputValue(new Date().toISOString())}
              onChange={(event) => setSinceDate(event.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-indigo-800 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
            {error}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm dark:border-indigo-900/60">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-indigo-900/60">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                Actor
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                Details
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                Timestamp
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white dark:divide-indigo-900/60 dark:bg-zinc-950">
            {filteredEntries.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-zinc-600 dark:text-zinc-300" colSpan={4}>
                  No audit activity recorded for the selected filters.
                </td>
              </tr>
            ) : (
              filteredEntries.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    <div className="flex flex-col gap-1">
                      <span>{ACTION_LABELS[row.action]}</span>
                      <CodePill className="bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
                        {row.tenantId}
                      </CodePill>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-100">
                    {row.actorId ? (
                      <CodePill className="bg-zinc-100 text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
                        {row.actorId}
                      </CodePill>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 break-words text-sm text-zinc-800 dark:text-zinc-100">{formatMeta(row)}</td>
                  <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
