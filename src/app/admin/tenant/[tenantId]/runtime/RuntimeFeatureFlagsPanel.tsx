"use client";

import { useCallback, useMemo, useState } from "react";

import type { FeatureFlagListItem } from "@/app/admin/feature-flags/FeatureFlagsPanel";
import { TENANT_HEADER } from "@/lib/auth/config";

type RuntimeFeatureFlagsPanelProps = {
  tenantId: string;
  initialFlags: FeatureFlagListItem[];
  canEdit: boolean;
  showRestrictedMessage?: boolean;
  safetyReason: string | null;
};

type FlagUpdateResult = {
  name: string;
  enabled: boolean;
};

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  return isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function describeScope(flag: FeatureFlagListItem) {
  const hasOverride = new Date(flag.updatedAt).getTime() > 0;
  return hasOverride ? "Tenant override" : "Default";
}

async function updateFlag(tenantId: string, name: string, enabled: boolean): Promise<FlagUpdateResult> {
  const response = await fetch("/api/feature-flags", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      [TENANT_HEADER]: tenantId,
    },
    body: JSON.stringify({ name, enabled }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = typeof errorBody.error === "string" ? errorBody.error : "Unable to update flag";
    throw new Error(message);
  }

  const data = (await response.json()) as FlagUpdateResult;
  return data;
}

export function RuntimeFeatureFlagsPanel({
  tenantId,
  initialFlags,
  canEdit,
  showRestrictedMessage,
  safetyReason,
}: RuntimeFeatureFlagsPanelProps) {
  const [flags, setFlags] = useState<FeatureFlagListItem[]>(() => initialFlags);
  const [savingFlag, setSavingFlag] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filteredFlags = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return flags;

    return flags.filter((flag) => {
      return (
        flag.name.toLowerCase().includes(term) ||
        (flag.description ?? "").toLowerCase().includes(term) ||
        describeScope(flag).toLowerCase().includes(term)
      );
    });
  }, [flags, query]);

  const handleToggle = useCallback(
    async (name: string, currentState: boolean) => {
      if (!canEdit) return;

      setSavingFlag(name);
      setError(null);

      try {
        const nextState = !currentState;

        setFlags((prev) =>
          prev.map((flag) =>
            flag.name === name ? { ...flag, enabled: nextState, updatedAt: new Date().toISOString() } : flag,
          ),
        );

        const result = await updateFlag(tenantId, name, nextState);

        setFlags((prev) =>
          prev.map((flag) =>
            flag.name === result.name
              ? { ...flag, enabled: result.enabled, updatedAt: new Date().toISOString() }
              : flag,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update flag";
        setError(message);
        setFlags((prev) => prev.map((flag) => (flag.name === name ? { ...flag, enabled: currentState } : flag)));
      } finally {
        setSavingFlag(null);
      }
    },
    [canEdit, tenantId],
  );

  return (
    <div className="space-y-4">
      {showRestrictedMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Changes restricted</p>
          <p>
            {safetyReason ||
              "You can view feature flags for this tenant, but you do not have permission to modify them."}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-700">
          <span className="font-semibold">Search flags</span>
          <input
            type="search"
            placeholder="Search by name, scope, or description"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <div className="text-sm text-zinc-500">{filteredFlags.length} flags</div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-100 text-sm">
          <thead className="bg-zinc-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredFlags.map((flag) => {
              const isSaving = savingFlag === flag.name;
              const scope = describeScope(flag);
              const updated = formatUpdatedAt(flag.updatedAt);

              return (
                <tr key={flag.name} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-900">{flag.name}</div>
                    <div className="text-xs text-zinc-500">{flag.description ?? "No description"}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{scope}</td>
                  <td className="px-4 py-3 text-zinc-700">{updated}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleToggle(flag.name, flag.enabled)}
                      disabled={!canEdit || isSaving}
                      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold shadow-sm transition ${
                        flag.enabled
                          ? "bg-emerald-600 text-white hover:bg-emerald-500"
                          : "bg-zinc-200 text-zinc-800 hover:bg-zinc-300"
                      } ${(!canEdit || isSaving) && "cursor-not-allowed opacity-60"}`}
                    >
                      {isSaving ? "Saving…" : flag.enabled ? "Enabled" : "Disabled"}
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
