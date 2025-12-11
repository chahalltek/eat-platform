"use client";

import { useMemo, useState } from "react";
import type { SystemModeName } from "@/lib/modes/systemModes";

const MODE_OPTIONS: { value: SystemModeName; label: string; description: string; accent: string }[] = [
  { value: "sandbox", label: "Sandbox", description: "Safe defaults for testing and integration", accent: "bg-blue-100 text-blue-800" },
  { value: "pilot", label: "Pilot", description: "Limited rollout with human review", accent: "bg-indigo-100 text-indigo-800" },
  { value: "production", label: "Production", description: "Full protections and live automations", accent: "bg-emerald-100 text-emerald-800" },
  {
    value: "fire_drill",
    label: "Fire Drill",
    description: "Pause non-essential agents and tighten guardrails",
    accent: "bg-amber-100 text-amber-900",
  },
];

type TenantModeCardProps = {
  tenantId: string;
  initialMode: SystemModeName;
};

export function TenantModeCard({ tenantId, initialMode }: TenantModeCardProps) {
  const [mode, setMode] = useState<SystemModeName>(initialMode);
  const [pendingMode, setPendingMode] = useState<SystemModeName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const modeLabel = useMemo(() => MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode, [mode]);

  async function persistMode(nextMode: SystemModeName) {
    setPendingMode(nextMode);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload.error === "string" ? payload.error : "Unable to update mode";
        throw new Error(message);
      }

      const payload = await response.json();
      setMode(payload.tenant.mode);
      setSuccessMessage(`${payload.tenant.name} is now in ${payload.tenant.mode.replace("_", " ")}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update mode";
      setError(message);
    } finally {
      setPendingMode(null);
      setConfirming(false);
    }
  }

  function handleSelect(nextMode: SystemModeName) {
    if (nextMode === mode) return;

    if (nextMode === "fire_drill") {
      setConfirming(true);
      setPendingMode(nextMode);
      return;
    }

    void persistMode(nextMode);
  }

  const isFireDrill = mode === "fire_drill";

  return (
    <section className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Mode</p>
          <h2 className="text-2xl font-semibold text-amber-900">Tenant operating mode</h2>
          <p className="text-sm text-amber-800">
            {isFireDrill
              ? "Fire Drill is active. Non-essential agents are paused and conservative guardrails are enforced."
              : "Select the posture for this tenant. Modes adjust risk tolerance and automation levels."}
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{modeLabel}</span>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {successMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {MODE_OPTIONS.map((option) => {
          const isSelected = option.value === mode;
          const isPending = pendingMode === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              disabled={Boolean(pendingMode)}
              className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                isSelected
                  ? "border-amber-400 bg-white ring-2 ring-amber-300"
                  : "border-amber-100 bg-white hover:-translate-y-0.5 hover:shadow-md"
              } ${isPending ? "opacity-70" : ""}`}
            >
              <div className="flex w-full items-center justify-between gap-3">
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${option.accent}`}>
                  <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
                  {option.label}
                </div>
                {isSelected ? (
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">Active</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-amber-900">{option.description}</p>
              {option.value === "fire_drill" ? (
                <p className="mt-1 text-xs font-semibold text-amber-800">
                  Pauses Explain + Confidence agents and locks conservative guardrails.
                </p>
              ) : null}
            </button>
          );
        })}
      </div>

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-amber-900">Activate Fire Drill mode?</h3>
            <p className="mt-2 text-sm text-amber-800">
              This will disable non-essential agents (Explain, Confidence) and force conservative guardrails. Proceed?
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:border-amber-300"
                onClick={() => {
                  setConfirming(false);
                  setPendingMode(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500"
                onClick={() => pendingMode && persistMode(pendingMode)}
              >
                Confirm activation
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
