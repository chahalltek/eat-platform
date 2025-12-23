"use client";

import { useMemo, useState } from "react";

import type { SystemModeName } from "@/lib/modes/systemModes";

const MODE_OPTIONS: { value: SystemModeName; label: string; description: string; accent: string }[] = [
  { value: "sandbox", label: "Sandbox", description: "Safe defaults for testing and integration", accent: "bg-blue-100 text-blue-800" },
  { value: "pilot", label: "Pilot", description: "Limited rollout with human review", accent: "bg-indigo-100 text-indigo-800" },
  { value: "production", label: "Production", description: "Full protections and live automations", accent: "bg-emerald-100 text-emerald-800" },
  {
    value: "maintenance",
    label: "Maintenance",
    description: "Take the tenant offline for non-admin users",
    accent: "bg-rose-100 text-rose-900",
  },
  {
    value: "fire_drill",
    label: "Fire Drill",
    description: "Pause non-essential agents and tighten guardrails",
    accent: "bg-amber-100 text-amber-900",
  },
];

type SystemModePanelProps = {
  initialMode: SystemModeName;
};

export function SystemModePanel({ initialMode }: SystemModePanelProps) {
  const [mode, setMode] = useState<SystemModeName>(initialMode);
  const [pendingMode, setPendingMode] = useState<SystemModeName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const modeLabel = useMemo(() => MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode, [mode]);
  const isFireDrill = mode === "fire_drill";
  const isMaintenance = mode === "maintenance";

  async function persistMode(nextMode: SystemModeName) {
    setPendingMode(nextMode);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/admin/mode", {
        method: "PUT",
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
    }
  }

  function handleSelect(nextMode: SystemModeName) {
    if (nextMode === mode || pendingMode) return;

    void persistMode(nextMode);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">System Mode</p>
          <h2 className="text-2xl font-semibold text-zinc-900">Tenant operating posture</h2>
          <p className="text-sm text-zinc-600">
            Choose the system mode for this tenant. Modes adjust guardrails and control which agents are allowed to run.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isFireDrill ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
              <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
              Fire Drill active
            </span>
          ) : null}
          {isMaintenance ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-900">
              <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />
              Maintenance active
            </span>
          ) : null}
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{modeLabel}</span>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {successMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      ) : null}

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
                  ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200"
                  : "border-zinc-200 bg-white hover:-translate-y-0.5 hover:shadow-md"
              } ${isPending ? "opacity-70" : ""}`}
            >
              <div className="flex w-full items-center justify-between gap-3">
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${option.accent}`}>
                  <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
                  {option.label}
                </div>
                {isSelected ? (
                  <span className="text-xs font-semibold uppercase tracking-wide text-indigo-800">Active</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-zinc-800">{option.description}</p>
              {option.value === "fire_drill" ? (
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  Explain and Confidence agents are paused; conservative guardrails enforced.
                </p>
              ) : null}
              {option.value === "maintenance" ? (
                <p className="mt-1 text-xs font-semibold text-rose-700">
                  Non-admin traffic is routed to the maintenance page.
                </p>
              ) : null}
            </button>
          );
        })}
      </div>

      {isFireDrill ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
            Fire Drill active. Non-essential agents are paused.
          </div>
          <p className="text-sm">Reset the tenant to pilot mode when the incident is resolved.</p>
          <div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500"
              onClick={() => handleSelect("pilot")}
              disabled={Boolean(pendingMode)}
            >
              Reset to Pilot
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
