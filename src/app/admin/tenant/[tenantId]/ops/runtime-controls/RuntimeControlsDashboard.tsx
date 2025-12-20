"use client";

import { useEffect, useMemo, useState } from "react";

<<<<<<< ours
=======
import { Switch } from "@/components/ui/switch";

>>>>>>> theirs
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

<<<<<<< ours
type ToggleSwitchProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  srLabel: string;
  activeTrackClassName: string;
  inactiveTrackClassName: string;
};

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  srLabel,
  activeTrackClassName,
  inactiveTrackClassName,
}: ToggleSwitchProps) {
  const trackClassName = classNames(
    checked ? activeTrackClassName : inactiveTrackClassName,
    "relative inline-flex h-6 w-11 items-center rounded-full transition focus:outline-none disabled:opacity-60",
  );

  const handleClassName = classNames(
    checked ? "translate-x-6" : "translate-x-1",
    "inline-block h-4 w-4 transform rounded-full bg-white transition",
  );

  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={onChange} className={trackClassName}>
      <span className="sr-only">{srLabel}</span>
      <span className={handleClassName} />
    </button>
  );
}
=======
const switchTrackClasses =
  "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-zinc-200 dark:data-[state=checked]:bg-indigo-500 dark:data-[state=unchecked]:bg-zinc-700";

const switchThumbClasses =
  "pointer-events-none block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 dark:bg-zinc-900";
>>>>>>> theirs

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
                <ToggleSwitch
                  checked={record.latched}
                  onCheckedChange={() => toggleKillSwitch(record)}
                  disabled={payload.readOnly || pendingKillSwitch === record.agentName}
<<<<<<< ours
<<<<<<< ours
                  activeTrackClassName="bg-rose-500"
                  inactiveTrackClassName="bg-emerald-500"
                  srLabel="Toggle kill switch"
                />
=======
                  data-state={record.latched ? "checked" : "unchecked"}
                  className={classNames(
                    switchTrackClasses,
                    "data-[state=checked]:bg-indigo-600 dark:data-[state=checked]:bg-indigo-500",
                  )}
                >
                  <span className="sr-only">Toggle kill switch</span>
                  <span
                    aria-hidden
                    data-state={record.latched ? "checked" : "unchecked"}
                    className={classNames(switchThumbClasses)}
                  />
                </Switch>
>>>>>>> theirs
=======
                  aria-label="Toggle kill switch"
                  className={classNames(
                    "data-[state=checked]:bg-rose-500 data-[state=unchecked]:bg-emerald-500",
                    "data-[state=checked]:ring-rose-500 data-[state=unchecked]:ring-emerald-500",
                  )}
                />
>>>>>>> theirs
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

                <ToggleSwitch
                  checked={flag.enabled}
                  onCheckedChange={() => toggleFlag(flag)}
                  disabled={payload.readOnly || pendingFlag === flag.name}
<<<<<<< ours
<<<<<<< ours
                  activeTrackClassName="bg-indigo-600"
                  inactiveTrackClassName="bg-zinc-300"
                  srLabel="Toggle feature flag"
                />
=======
                  data-state={flag.enabled ? "checked" : "unchecked"}
                  className={classNames(
                    switchTrackClasses,
                    "data-[state=checked]:bg-indigo-600 dark:data-[state=checked]:bg-indigo-500",
                  )}
                >
                  <span className="sr-only">Toggle feature flag</span>
                  <span
                    aria-hidden
                    data-state={flag.enabled ? "checked" : "unchecked"}
                    className={classNames(switchThumbClasses)}
                  />
                </Switch>
>>>>>>> theirs
=======
                  aria-label="Toggle feature flag"
                />
>>>>>>> theirs
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
