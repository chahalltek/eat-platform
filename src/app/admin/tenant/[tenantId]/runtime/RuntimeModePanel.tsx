"use client";

import { useCallback, useMemo, useState } from "react";

import { ETECard } from "@/components/ETECard";
import { AdminCardTitle } from "@/components/admin/AdminCardTitle";
import { SYSTEM_MODES, type SystemModeName } from "@/lib/modes/systemModes";

const MODE_LABELS: Record<SystemModeName, string> = {
  pilot: "Pilot",
  production: "Production",
  sandbox: "Sandbox",
  fire_drill: "Fire Drill",
  demo: "Demo",
};

const MODE_HELP: Record<SystemModeName, string> = {
  pilot: "Conservative defaults with core agents only.",
  production: "Full platform behavior and balanced guardrails.",
  sandbox: "Exploratory defaults with larger shortlists and lower thresholds.",
  fire_drill: "Strict guardrails, no LLM-reliant agents, reduced blast radius.",
  demo: "Safe demo profile with limited agents and outputs.",
};

type RuntimeModePanelProps = {
  tenantId: string;
  mode: SystemModeName;
  canEdit: boolean;
  showRestrictedMessage?: boolean;
  safetyReason: string | null;
};

type UpdateResponse = { tenant: { mode: SystemModeName } };

export function RuntimeModePanel({ tenantId, mode, canEdit, safetyReason, showRestrictedMessage }: RuntimeModePanelProps) {
  const [selectedMode, setSelectedMode] = useState<SystemModeName>(mode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modeOptions = useMemo(() => Object.keys(SYSTEM_MODES) as SystemModeName[], []);

  const handleSave = useCallback(async () => {
    if (!canEdit || saving || selectedMode === mode) return;

    const confirmed = window.confirm(`Apply ${MODE_LABELS[selectedMode]} mode to tenant ${tenantId}?`);

    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedMode }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = typeof body.error === "string" ? body.error : "Unable to update mode";
        throw new Error(message);
      }

      const data = (await response.json()) as UpdateResponse;
      setSelectedMode(data.tenant.mode);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update mode";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [canEdit, mode, saving, selectedMode, tenantId]);

  return (
    <ETECard className="gap-4 border-indigo-100 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <AdminCardTitle className="text-lg" stabilizeHeight>
            Mode
          </AdminCardTitle>
          <p className="text-sm text-zinc-600">
            Swap between predefined runtime profiles. Changes impact guardrails, agents, and scoring defaults.
          </p>
        </div>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Tenant runtime
        </span>
      </div>

      {showRestrictedMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Changes restricted</p>
          <p>
            {safetyReason ||
              "You can view the current mode, but you do not have permission to modify tenant runtime profiles."}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex flex-1 flex-col gap-2 text-sm text-zinc-700">
          <span className="font-semibold">Current mode</span>
          <select
            value={selectedMode}
            onChange={(event) => setSelectedMode(event.target.value as SystemModeName)}
            disabled={!canEdit || saving}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100"
          >
            {modeOptions.map((key) => (
              <option key={key} value={key}>
                {MODE_LABELS[key]}
              </option>
            ))}
          </select>
          <span className="text-xs text-zinc-500">{MODE_HELP[selectedMode]}</span>
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canEdit || saving || selectedMode === mode}
          className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
            !canEdit || selectedMode === mode
              ? "bg-zinc-300 text-zinc-700"
              : "bg-indigo-600 hover:bg-indigo-500"
          } ${saving ? "opacity-70" : ""}`}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </ETECard>
  );
}
