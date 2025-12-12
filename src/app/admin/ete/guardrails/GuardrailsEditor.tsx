"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

import { ETECard } from "@/components/ETECard";
import { defaultTenantGuardrails, type TenantGuardrails } from "@/lib/tenant/guardrails";

const PRESET_VALUES: Record<"Conservative" | "Balanced" | "Aggressive", TenantGuardrails> = {
  Conservative: {
    scoring: {
      strategy: "weighted",
      weights: {
        mustHaveSkills: 55,
        niceToHaveSkills: 15,
        experience: 20,
        location: 10,
      },
      thresholds: {
        minMatchScore: 70,
        shortlistMinScore: 80,
        shortlistMaxCandidates: 8,
      },
    },
    explain: {
      level: "compact",
      includeWeights: true,
    },
    safety: {
      requireMustHaves: true,
      excludeInternalCandidates: true,
    },
    llm: defaultTenantGuardrails.llm,
  },
  Balanced: {
    scoring: {
      strategy: "weighted",
      weights: {
        mustHaveSkills: 40,
        niceToHaveSkills: 20,
        experience: 25,
        location: 15,
      },
      thresholds: {
        minMatchScore: 60,
        shortlistMinScore: 75,
        shortlistMaxCandidates: 10,
      },
    },
    explain: {
      level: "compact",
      includeWeights: true,
    },
    safety: {
      requireMustHaves: true,
      excludeInternalCandidates: false,
    },
    llm: defaultTenantGuardrails.llm,
  },
  Aggressive: {
    scoring: {
      strategy: "weighted",
      weights: {
        mustHaveSkills: 35,
        niceToHaveSkills: 25,
        experience: 25,
        location: 15,
      },
      thresholds: {
        minMatchScore: 50,
        shortlistMinScore: 65,
        shortlistMaxCandidates: 15,
      },
    },
    explain: {
      level: "detailed",
      includeWeights: true,
    },
    safety: {
      requireMustHaves: false,
      excludeInternalCandidates: false,
    },
    llm: defaultTenantGuardrails.llm,
  },
};

type GuardrailResponse = {
  guardrails: TenantGuardrails;
  defaults: TenantGuardrails;
};

type PresetKey = keyof typeof PRESET_VALUES;

function matchesPreset(config: TenantGuardrails, preset: TenantGuardrails) {
  return (
    config.scoring.strategy === preset.scoring.strategy &&
    Object.entries(preset.scoring.weights).every(([key, value]) => config.scoring.weights[key as keyof typeof preset.scoring.weights] === value) &&
    Object.entries(preset.scoring.thresholds).every(
      ([key, value]) => config.scoring.thresholds[key as keyof typeof preset.scoring.thresholds] === value,
    ) &&
    config.explain.level === preset.explain.level &&
    config.explain.includeWeights === preset.explain.includeWeights &&
    config.safety.requireMustHaves === preset.safety.requireMustHaves &&
    config.safety.excludeInternalCandidates === preset.safety.excludeInternalCandidates
  );
}

function findPreset(config: TenantGuardrails) {
  return (Object.keys(PRESET_VALUES) as PresetKey[]).find((key) => matchesPreset(config, PRESET_VALUES[key])) ?? null;
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function GuardrailsEditor({ tenantId }: { tenantId: string }) {
  const [config, setConfig] = useState<TenantGuardrails | null>(null);
  const [defaults, setDefaults] = useState<TenantGuardrails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);
  const [showPresetConfirm, setShowPresetConfirm] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<PresetKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);

  const presetOptions = useMemo(() => [
    { value: "Conservative", description: "Strict matching and shortlist controls." },
    { value: "Balanced", description: "Default mix of safety and throughput." },
    { value: "Aggressive", description: "Faster shortlists with more lenient gating." },
  ], []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadGuardrails() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/tenant/${tenantId}/guardrails`, { signal: controller.signal });

        if (!response.ok) {
          throw new Error("Unable to load guardrails");
        }

        const data = (await response.json()) as GuardrailResponse;
        setConfig(data.guardrails);
        setDefaults(data.defaults);
        setActivePreset(findPreset(data.guardrails));
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setError((fetchError as Error).message || "Failed to load guardrails");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadGuardrails();

    return () => controller.abort();
  }, [tenantId]);

  async function saveConfig(nextConfig: TenantGuardrails | null = config) {
    if (!nextConfig) return;
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tenant/${tenantId}/guardrails`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextConfig),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = (payload as { error?: string })?.error ?? "Unable to save guardrails";
        throw new Error(message);
      }

      const data = (await response.json()) as { guardrails: TenantGuardrails };
      setConfig(data.guardrails);
      setActivePreset(findPreset(data.guardrails));
      setStatus({ tone: "success", message: "Guardrails saved successfully." });
    } catch (saveError) {
      setStatus({ tone: "error", message: (saveError as Error).message || "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!defaults) return;
    setConfig(defaults);
    await saveConfig(defaults);
  }

  function handlePresetChange(value: string) {
    if (!value || value === "Custom") {
      setActivePreset(null);
      setPendingPreset(null);
      setShowPresetConfirm(false);
      return;
    }
    setPendingPreset(value as PresetKey);
    setShowPresetConfirm(true);
  }

  function applyPreset(preset: PresetKey) {
    const presetValues = PRESET_VALUES[preset];
    setConfig(presetValues);
    setActivePreset(preset);
    setShowPresetConfirm(false);
    setPendingPreset(null);
    setStatus({ tone: "info", message: `${preset} preset applied locally. Remember to save.` });
  }

  function updateWeight(key: keyof TenantGuardrails["scoring"]["weights"], value: string) {
    setConfig((current) =>
      current
        ? {
            ...current,
            scoring: {
              ...current.scoring,
              weights: { ...current.scoring.weights, [key]: numberValue(value) },
            },
          }
        : current,
    );
    setActivePreset(null);
  }

  function updateThreshold(key: keyof TenantGuardrails["scoring"]["thresholds"], value: string) {
    setConfig((current) =>
      current
        ? {
            ...current,
            scoring: {
              ...current.scoring,
              thresholds: { ...current.scoring.thresholds, [key]: numberValue(value) },
            },
          }
        : current,
    );
    setActivePreset(null);
  }

  function updateExplain(key: keyof TenantGuardrails["explain"], value: string | boolean) {
    setConfig((current) => (current ? { ...current, explain: { ...current.explain, [key]: value } } : current));
    setActivePreset(null);
  }

  function updateSafety(key: keyof TenantGuardrails["safety"], value: boolean) {
    setConfig((current) => (current ? { ...current, safety: { ...current.safety, [key]: value } } : current));
    setActivePreset(null);
  }

  function updateStrategy(value: TenantGuardrails["scoring"]["strategy"]) {
    setConfig((current) => (current ? { ...current, scoring: { ...current.scoring, strategy: value } } : current));
    setActivePreset(null);
  }

  if (loading) {
    return (
      <ETECard className="gap-4">
        <div className="h-6 w-40 animate-pulse rounded-lg bg-zinc-200" />
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-200" />
        </div>
        <div className="h-32 w-full animate-pulse rounded-2xl bg-zinc-200" />
      </ETECard>
    );
  }

  if (error || !config) {
    return (
      <ETECard className="gap-4">
        <div className="flex items-center gap-2 text-amber-800">
          <ExclamationCircleIcon className="h-5 w-5" aria-hidden />
          <p className="font-semibold">{error ?? "Unable to load guardrails."}</p>
        </div>
        <p className="text-sm text-zinc-600">Please retry or contact an administrator if this continues.</p>
      </ETECard>
    );
  }

  const presetLabel = activePreset ?? "Custom";
  const StatusIcon = status?.tone === "error" ? ExclamationCircleIcon : CheckCircleIcon;

  return (
    <div className="flex flex-col gap-4">
      {status ? (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            status.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : status.tone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-indigo-200 bg-indigo-50 text-indigo-800"
          }`}
          role="status"
        >
          <StatusIcon className="h-5 w-5" aria-hidden />
          <p>{status.message}</p>
        </div>
      ) : null}

      <ETECard className="gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Preset</p>
            <h2 className="text-2xl font-semibold text-zinc-900">Guardrails presets</h2>
            <p className="text-sm text-zinc-600">Switch between curated guardrails profiles or stay in Custom mode.</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-indigo-50 px-4 py-3 text-indigo-700 shadow-sm">
            <ShieldCheckIcon className="h-5 w-5" aria-hidden />
            <div className="flex flex-col text-xs font-medium uppercase tracking-wide">
              <span>Active preset</span>
              <span className="text-base normal-case text-indigo-900">{presetLabel}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-800">Preset selection</p>
              <p className="text-xs text-zinc-500">Applying a preset will overwrite the current values below.</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                className="w-56 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                value={presetLabel}
                onChange={(event) => handlePresetChange(event.target.value)}
              >
                <option value="Custom">Custom</option>
                {presetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value}
                  </option>
                ))}
              </select>
              <span className="text-sm text-zinc-500">or keep editing as Custom.</span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {presetOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handlePresetChange(option.value)}
                className={`flex h-full flex-col gap-2 rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                  activePreset === option.value
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-zinc-200 bg-zinc-50 hover:border-indigo-200 hover:bg-indigo-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-900">{option.value}</span>
                  {activePreset === option.value ? (
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500" aria-hidden />
                  ) : (
                    <SparklesIcon className="h-5 w-5 text-indigo-400" aria-hidden />
                  )}
                </div>
                <p className="text-xs text-zinc-500">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
      </ETECard>

      <ETECard className="gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Scoring</p>
          <h2 className="text-xl font-semibold text-zinc-900">Shortlist scoring</h2>
          <p className="text-sm text-zinc-600">Adjust scoring strategy, weights, and shortlist thresholds.</p>
        </div>

        <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-800">Scoring strategy</label>
              <select
                value={config.scoring.strategy}
                onChange={(event) => updateStrategy(event.target.value as TenantGuardrails["scoring"]["strategy"])}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="simple">Simple</option>
                <option value="weighted">Weighted</option>
              </select>
              <p className="text-xs text-zinc-500">Weighted keeps the sliders active; Simple applies even scoring.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(config.scoring.weights).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <label className="text-sm font-medium capitalize text-zinc-800">{key}</label>
                  <input
                    type="number"
                    min={0}
                    value={value}
                    onChange={(event) => updateWeight(key as keyof TenantGuardrails["scoring"]["weights"], event.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                  />
                  <p className="text-xs text-zinc-500">Weight for {key.replace(/([A-Z])/g, " $1").toLowerCase()}.</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-800">Min match score</label>
              <input
                type="number"
                min={0}
                value={config.scoring.thresholds.minMatchScore}
                onChange={(event) => updateThreshold("minMatchScore", event.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
              />
              <p className="text-xs text-zinc-500">Minimum score to keep a candidate in the pool.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-800">Shortlist min score</label>
              <input
                type="number"
                min={0}
                value={config.scoring.thresholds.shortlistMinScore}
                onChange={(event) => updateThreshold("shortlistMinScore", event.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
              />
              <p className="text-xs text-zinc-500">Candidates above this score reach the shortlist.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-800">Shortlist max candidates</label>
              <input
                type="number"
                min={1}
                value={config.scoring.thresholds.shortlistMaxCandidates}
                onChange={(event) => updateThreshold("shortlistMaxCandidates", event.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
              />
              <p className="text-xs text-zinc-500">Cap the shortlist for downstream review.</p>
            </div>
          </div>
        </div>
      </ETECard>

      <ETECard className="gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Explainability</p>
          <h2 className="text-xl font-semibold text-zinc-900">Explainability settings</h2>
          <p className="text-sm text-zinc-600">Control how much detail appears in explanations for recruiters and admins.</p>
        </div>

        <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-800">Explanation level</label>
            <select
              value={config.explain.level}
              onChange={(event) => updateExplain("level", event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="compact">Compact</option>
              <option value="detailed">Detailed</option>
            </select>
            <p className="text-xs text-zinc-500">Detailed includes more reasoning and examples.</p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-800">Include weights in explanations</p>
              <p className="text-xs text-zinc-500">Show how weights contributed to the final score.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                checked={config.explain.includeWeights}
                onChange={(event) => updateExplain("includeWeights", event.target.checked)}
              />
              <span className="text-sm text-zinc-700">Enabled</span>
            </label>
          </div>
        </div>
      </ETECard>

      <ETECard className="gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Safety</p>
          <h2 className="text-xl font-semibold text-zinc-900">Safety controls</h2>
          <p className="text-sm text-zinc-600">Keep shortlist quality high with safeguards that block risky candidates.</p>
        </div>

        <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-800">Require must-have skills</p>
              <p className="text-xs text-zinc-500">Only shortlist candidates meeting all must-have criteria.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                checked={config.safety.requireMustHaves}
                onChange={(event) => updateSafety("requireMustHaves", event.target.checked)}
              />
              <span className="text-sm text-zinc-700">Enabled</span>
            </label>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-800">Exclude internal candidates</p>
              <p className="text-xs text-zinc-500">Blocks matches for internal employees unless explicitly allowed.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                checked={config.safety.excludeInternalCandidates}
                onChange={(event) => updateSafety("excludeInternalCandidates", event.target.checked)}
              />
              <span className="text-sm text-zinc-700">Enabled</span>
            </label>
          </div>
        </div>
      </ETECard>

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-700">
            <ArrowPathIcon className="h-5 w-5 text-indigo-500" aria-hidden />
            <p className="text-sm">Save to persist changes for this tenant or reset to defaults.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving || !defaults}
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset to defaults
            </button>
            <button
              type="button"
              onClick={() => saveConfig()}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save guardrails"}
            </button>
          </div>
        </div>
      </div>

      {showPresetConfirm && pendingPreset ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="mt-0.5 h-6 w-6 text-indigo-600" aria-hidden />
              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-zinc-900">Apply the {pendingPreset} preset?</h4>
                <p className="text-sm text-zinc-600">
                  Apply the "{pendingPreset}" preset and overwrite current values? You can still tweak them after applying.
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPresetConfirm(false);
                  setPendingPreset(null);
                }}
                className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => applyPreset(pendingPreset)}
                className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                Confirm preset
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
