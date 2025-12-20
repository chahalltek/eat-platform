"use client";

import { useEffect, useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { TENANT_HEADER } from "@/lib/auth/config";
import type { AgentKillSwitchRecord } from "@/lib/agents/killSwitch";
import type { FeatureFlagRecord } from "@/lib/featureFlags";
import type { SystemModeName } from "@/lib/modes/systemModes";

type RuntimeControlPayload = {
  tenantId: string;
  executionMode: SystemModeName;
  executionModes: readonly { id: SystemModeName; label: string; description: string }[];
  killSwitches: AgentKillSwitchRecord[];
  featureFlags: FeatureFlagRecord[];
  readOnly: boolean;
  warnings: string[];
};

type RuntimeControlsDashboardProps = {
  tenantId: string;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function RuntimeControlsDashboard({ tenantId }: RuntimeControlsDashboardProps) {
  const [payload, setPayload] = useState<RuntimeControlPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [savingMode, setSavingMode] = useState<SystemModeName | null>(null);
  const [pendingKillSwitch, setPendingKillSwitch] = useState<string | null>(null);
  const [pendingFlag, setPendingFlag] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/tenant/${tenantId}/ops/runtime-controls`, {
          cache: "no-store",
          headers: { [TENANT_HEADER]: tenantId },
        });

        if (!response.ok) {
          throw new Error("Unable to load runtime controls");
        }

        const data = (await response.json()) as RuntimeControlPayload;
        setPayload(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load runtime controls";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [tenantId]);

  const filteredFlags = useMemo(() => {
    if (!payload) return [];

    const query = search.trim().toLowerCase();
    if (!query) return payload.featureFlags;

    return payload.featureFlags.filter(
      (flag) => flag.name.toLowerCase().includes(query) || (flag.description ?? "").toLowerCase().includes(query),
    );
  }, [payload, search]);

  async function updateMode(nextMode: SystemModeName) {
    if (!payload || payload.readOnly || nextMode === payload.executionMode) return;
    setSavingMode(nextMode);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tenant/${tenantId}/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [TENANT_HEADER]: tenantId },
        body: JSON.stringify({ mode: nextMode }),
      });

      if (!response.ok) {
        throw new Error("Unable to update execution mode");
      }

      setPayload((prev) => (prev ? { ...prev, executionMode: nextMode } : prev));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update execution mode";
      setError(message);
    } finally {
      setSavingMode(null);
    }
  }

  async function toggleKillSwitch(record: AgentKillSwitchRecord) {
    if (!payload || payload.readOnly) return;

    const nextLatched = !record.latched;
    const reason = nextLatched ? window.prompt("Reason for enabling kill switch?", record.reason ?? "") ?? "" : null;

    setPendingKillSwitch(record.agentName);
    setError(null);
    setPayload((prev) =>
      prev
        ? {
            ...prev,
            killSwitches: prev.killSwitches.map((item) =>
              item.agentName === record.agentName
                ? { ...item, latched: nextLatched, latchedAt: nextLatched ? new Date() : null, reason: reason ?? null }
                : item,
            ),
          }
        : prev,
    );

    try {
      const response = await fetch(`/api/admin/agents/kill-switch`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [TENANT_HEADER]: tenantId },
        body: JSON.stringify({ agentName: record.agentName, latched: nextLatched, reason }),
      });

      if (!response.ok) {
        throw new Error("Unable to update kill switch");
      }

      const updated = (await response.json()) as AgentKillSwitchRecord;
      setPayload((prev) =>
        prev
          ? {
              ...prev,
              killSwitches: prev.killSwitches.map((item) =>
                item.agentName === updated.agentName ? { ...item, ...updated } : item,
              ),
            }
          : prev,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update kill switch";
      setError(message);
      setPayload((prev) => (prev ? { ...prev, killSwitches: payload.killSwitches } : prev));
    } finally {
      setPendingKillSwitch(null);
    }
  }

  async function toggleFlag(flag: FeatureFlagRecord) {
    if (!payload || payload.readOnly) return;
    const enabled = !flag.enabled;
    setPendingFlag(flag.name);
    setError(null);
    setPayload((prev) =>
      prev
        ? { ...prev, featureFlags: prev.featureFlags.map((item) => (item.name === flag.name ? { ...item, enabled } : item)) }
        : prev,
    );

    try {
      const response = await fetch(`/api/admin/tenant/${tenantId}/feature-flags`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [TENANT_HEADER]: tenantId },
        body: JSON.stringify({ name: flag.name, enabled }),
      });

      if (!response.ok) {
        throw new Error("Unable to update feature flag");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update feature flag";
      setError(message);
      setPayload((prev) => (prev ? { ...prev, featureFlags: payload.featureFlags } : prev));
    } finally {
      setPendingFlag(null);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-zinc-200 bg-white p-6">Loading runtime controls…</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold">Unable to load runtime controls</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!payload) return null;

  return (
    <div className="flex flex-col gap-6">
      {payload.readOnly ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Read-only in this environment</p>
          <p>Changes are disabled. Switch to a writable environment to modify runtime controls.</p>
        </div>
      ) : null}

      {payload.warnings.length ? (
        <div className="space-y-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <p className="font-semibold">Warnings</p>
          <ul className="list-disc space-y-1 pl-5">
            {payload.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Section 1</p>
          <h2 className="text-xl font-semibold text-zinc-900">Execution mode</h2>
          <p className="text-sm text-zinc-600">Swap between operational profiles for tenant {tenantId}.</p>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          {payload.executionModes.map((mode) => {
            const selected = payload.executionMode === mode.id;
            const disabled = payload.readOnly;

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => updateMode(mode.id)}
                disabled={disabled}
                className={classNames(
                  "flex flex-col gap-1 rounded-xl border px-4 py-3 text-left shadow-sm transition",
                  selected
                    ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                    : "border-zinc-200 bg-white text-zinc-800 hover:border-indigo-200",
                  disabled ? "cursor-not-allowed opacity-60" : "",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{mode.label}</span>
                  {savingMode === mode.id ? <span className="text-xs text-indigo-700">Saving…</span> : null}
                </div>
                <p className="text-xs text-zinc-600">{mode.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Section 2</p>
          <h2 className="text-xl font-semibold text-zinc-900">Kill switches</h2>
          <p className="text-sm text-zinc-600">Toggle individual agents on or off with a reason for auditability.</p>
        </header>

        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
          {payload.killSwitches.map((record) => {
            const statusLabel = record.latched ? "Disabled" : "Active";
            return (
              <div
                key={record.agentName}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{record.agentName}</p>
                  <p className="text-xs text-zinc-600">
                    {statusLabel} {record.reason ? `· ${record.reason}` : ""}
                  </p>
                </div>
                <Switch
                  checked={record.latched}
                  onCheckedChange={() => toggleKillSwitch(record)}
                  disabled={payload.readOnly || pendingKillSwitch === record.agentName}
                  aria-label="Toggle kill switch"
                  className={classNames(
                    "data-[state=checked]:bg-rose-500 data-[state=unchecked]:bg-emerald-500",
                    "data-[state=checked]:ring-rose-500 data-[state=unchecked]:ring-emerald-500",
                  )}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Section 3</p>
          <h2 className="text-xl font-semibold text-zinc-900">Feature flags</h2>
          <p className="text-sm text-zinc-600">Searchable list of feature flags with instant toggles.</p>
        </header>

        <div className="flex flex-col gap-4">
          <input
            type="search"
            placeholder="Search flags"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
          />

          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {filteredFlags.map((flag) => (
              <div key={flag.name} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col">
                  <p className="text-sm font-semibold text-zinc-900">{flag.name}</p>
                  <p className="text-xs text-zinc-600">{flag.description}</p>
                </div>

                <Switch
                  checked={flag.enabled}
                  onCheckedChange={() => toggleFlag(flag)}
                  disabled={payload.readOnly || pendingFlag === flag.name}
                  aria-label="Toggle feature flag"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
