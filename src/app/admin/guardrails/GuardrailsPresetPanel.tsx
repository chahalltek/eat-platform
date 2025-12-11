'use client';

import { useMemo, useState } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

import { ETECard } from "@/components/ETECard";

const PRESET_CONFIGS = {
  Conservative: {
    scoringMode: "Use Safety preset",
    safetyLevel: "Prefer blocks",
    maxInputTokens: 1500,
    maxOutputTokens: 120,
  },
  Balanced: {
    scoringMode: "auto (Prefer blocks)",
    safetyLevel: "Prefer blocks",
    maxInputTokens: 2000,
    maxOutputTokens: 600,
  },
  Aggressive: {
    scoringMode: "auto (Prefer completions)",
    safetyLevel: "Prefer completions",
    maxInputTokens: 4000,
    maxOutputTokens: null,
  },
} satisfies Record<
  "Conservative" | "Balanced" | "Aggressive",
  {
    scoringMode: string;
    safetyLevel: string;
    maxInputTokens: number;
    maxOutputTokens: number | null;
  }
>;

type GuardrailConfig = {
  preset: keyof typeof PRESET_CONFIGS | null;
  scoringMode: string;
  modelId: string;
  scoringEndpoint: string;
  guardrailRules: string;
  ruleSupport: string;
  safetyLevel: string;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
};

type GuardrailsPresetPanelProps = {
  initialConfig: GuardrailConfig;
};

export function GuardrailsPresetPanel({ initialConfig }: GuardrailsPresetPanelProps) {
  const [config, setConfig] = useState<GuardrailConfig>(initialConfig);
  const [pendingPreset, setPendingPreset] = useState<GuardrailConfig["preset"]>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "neutral">("neutral");
  const [lastAppliedConfig, setLastAppliedConfig] = useState<GuardrailConfig>(initialConfig);
  const [showOfflineWarning, setShowOfflineWarning] = useState(() =>
    !initialConfig.scoringEndpoint || !initialConfig.modelId,
  );

  const presetOptions = useMemo(
    () => [
      { label: "Conservative", description: "Strict blocking and limited outputs." },
      { label: "Balanced", description: "Default controls with safe fallbacks." },
      { label: "Aggressive", description: "Favor completions while keeping core guardrails." },
    ],
    [],
  );

  const appliedPresetLabel = pendingPreset ?? config.preset;

  function handlePresetSelect(value: string) {
    if (!value) {
      cancelPreset();
      return;
    }

    openPresetConfirmation(value as GuardrailConfig["preset"]);
  }

  function openPresetConfirmation(nextPreset: GuardrailConfig["preset"]) {
    setPendingPreset(nextPreset);
    setShowConfirm(true);
  }

  function applyPreset(preset: keyof typeof PRESET_CONFIGS) {
    const presetConfig = PRESET_CONFIGS[preset];
    setConfig((current) => ({
      ...current,
      preset,
      scoringMode: presetConfig.scoringMode,
      safetyLevel: presetConfig.safetyLevel,
      maxInputTokens: presetConfig.maxInputTokens,
      maxOutputTokens: presetConfig.maxOutputTokens,
    }));
    setPendingPreset(null);
    setShowConfirm(false);
    setShowOfflineWarning(true);
  }

  function cancelPreset() {
    setPendingPreset(null);
    setShowConfirm(false);
  }

  function handleNumericChange(key: "maxInputTokens" | "maxOutputTokens", value: string) {
    const parsed = value === "" ? null : Number(value);
    setConfig((current) => ({
      ...current,
      [key]: Number.isNaN(parsed) ? null : parsed,
    }));
  }

  function updateField(key: keyof GuardrailConfig, value: string | number | null) {
    setConfig((current) => ({
      ...current,
      [key]: value as never,
    }));
  }

  function formatUpdatedFields(nextConfig: GuardrailConfig, previousConfig: GuardrailConfig) {
    const labels: string[] = [];

    if (nextConfig.modelId !== previousConfig.modelId) labels.push("Model ID");
    if (nextConfig.scoringEndpoint !== previousConfig.scoringEndpoint) labels.push("scoring endpoint");
    if (nextConfig.guardrailRules !== previousConfig.guardrailRules) labels.push("guardrail rules");
    if (nextConfig.scoringMode !== previousConfig.scoringMode) labels.push("scoring mode");
    if (nextConfig.safetyLevel !== previousConfig.safetyLevel) labels.push("safety level");
    if (nextConfig.maxInputTokens !== previousConfig.maxInputTokens) labels.push("max input tokens");
    if (nextConfig.maxOutputTokens !== previousConfig.maxOutputTokens) labels.push("max output tokens");

    return labels.join(", ");
  }

  function handleApply() {
    const changedFields = formatUpdatedFields(config, lastAppliedConfig);

    if (config.preset) {
      const updatedPart = changedFields ? ` and updated: ${changedFields}` : "";
      setStatusMessage(`Applied: ${config.preset} preset${updatedPart ? updatedPart : ""}.`);
      setStatusTone("success");
    } else {
      setStatusMessage(changedFields ? `Applied updates: ${changedFields}.` : "Applied updates.");
      setStatusTone("neutral");
    }

    setLastAppliedConfig(config);
    if (!config.modelId || !config.scoringEndpoint) {
      setShowOfflineWarning(true);
    }
  }

  const offlineNoticeActive = showOfflineWarning && (!config.modelId || !config.scoringEndpoint);

  return (
    <ETECard className="gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Guardrails</p>
          <h2 className="text-2xl font-semibold text-zinc-900">Preset picker</h2>
          <p className="text-sm text-zinc-600">
            Select a guardrail stance, then adjust scoring and token settings before applying updates.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-indigo-50 px-4 py-3 text-indigo-700 shadow-sm">
          <ShieldCheckIcon className="h-5 w-5" aria-hidden />
          <div className="flex flex-col text-xs font-medium uppercase tracking-wide">
            <span>Current preset</span>
            <span className="text-base normal-case text-indigo-900">{config.preset ?? "Not set"}</span>
          </div>
        </div>
      </div>

      {offlineNoticeActive ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5" aria-hidden />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">-- Guardrails are offline --</p>
            <p>No connection settings have been provided. Add them below to resume enforcement.</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-800">Preset</p>
            <p className="text-xs text-zinc-500">Apply a preset before updating connection details.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preset selection</label>
            <select
              className="w-56 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
              value={appliedPresetLabel ?? ""}
              onChange={(event) => handlePresetSelect(event.target.value)}
            >
              <option value="">Choose a preset</option>
              {presetOptions.map((option) => (
                <option key={option.label} value={option.label}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {presetOptions.map((option) => (
            <div
              key={option.label}
              className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 shadow-inner"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-900">{option.label}</span>
                {config.preset === option.label ? (
                  <CheckCircleIcon className="h-5 w-5 text-emerald-500" aria-hidden />
                ) : null}
              </div>
              <p className="text-xs text-zinc-500">{option.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 id="default-guardrails" className="text-lg font-semibold text-zinc-900 underline underline-offset-4">
          Guardrails global rules
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-800">Model ID</label>
            <input
              type="text"
              value={config.modelId}
              onChange={(event) => updateField("modelId", event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
            />
            <p className="text-xs text-zinc-500">Used for guardrail and scoring calls.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-800">Scoring endpoint</label>
            <input
              type="text"
              value={config.scoringEndpoint}
              onChange={(event) => updateField("scoringEndpoint", event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
            />
            <p className="text-xs text-zinc-500">Endpoint for evaluating and blocking risky outputs.</p>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-800">Guardrails global rules</label>
          <textarea
            value={config.guardrailRules}
            onChange={(event) => updateField("guardrailRules", event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
          />
          <p className="text-xs text-zinc-500">Document how requests are blocked and redacted across the platform.</p>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 id="interaction-safeguards" className="text-lg font-semibold text-zinc-900 underline underline-offset-4">
          Interaction safeguards
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-800">Rule support</label>
            <select
              value={config.ruleSupport}
              disabled
              className="w-full rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 shadow-sm"
            >
              <option value="Disabled">Disabled (no rules)</option>
              <option value="Enforce guardrail rules">Enforce guardrail rules</option>
            </select>
            <p className="text-xs text-zinc-500">Guardrail rules remain enforced in every preset.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-800">Safety level</label>
            <select
              value={config.safetyLevel}
              onChange={(event) => updateField("safetyLevel", event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="Prefer blocks">Prefer blocks</option>
              <option value="Prefer completions">Prefer completions</option>
            </select>
            <p className="text-xs text-zinc-500">Controlled by presets; adjust to balance safety vs completions.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-800">Scoring mode</label>
            <select
              value={config.scoringMode}
              onChange={(event) => updateField("scoringMode", event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="auto (Prefer blocks)">auto (Prefer blocks)</option>
              <option value="auto (Prefer completions)">auto (Prefer completions)</option>
              <option value="Use Safety preset">Use Safety preset</option>
            </select>
            <p className="text-xs text-zinc-500">Defaults follow the selected preset.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-800">Max input tokens</label>
            <input
              type="number"
              min={0}
              value={config.maxInputTokens ?? ""}
              onChange={(event) => handleNumericChange("maxInputTokens", event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
            />
            <p className="text-xs text-zinc-500">Set to a non-zero value for aggressive or conservative presets.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-800">Max output tokens</label>
            <input
              type="number"
              min={0}
              value={config.maxOutputTokens ?? ""}
              onChange={(event) => handleNumericChange("maxOutputTokens", event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
            />
            <p className="text-xs text-zinc-500">Set a limit before applying presets that demand output caps.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-700">
            <InformationCircleIcon className="h-5 w-5 text-indigo-500" aria-hidden />
            <p className="text-sm">Review settings, then apply updates to store this configuration locally.</p>
          </div>
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
          >
            Apply updates
          </button>
        </div>
        {statusMessage ? (
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
              statusTone === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-zinc-200 bg-zinc-50 text-zinc-800"
            }`}
          >
            <CheckCircleIcon
              className={`h-5 w-5 ${statusTone === "success" ? "text-emerald-500" : "text-zinc-500"}`}
              aria-hidden
            />
            <p>{statusMessage}</p>
          </div>
        ) : null}
      </div>

      {showConfirm && pendingPreset ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="mt-0.5 h-6 w-6 text-indigo-600" aria-hidden />
              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-zinc-900">Apply the {pendingPreset} preset?</h4>
                <p className="text-sm text-zinc-600">
                  Apply the "{pendingPreset}" preset? This will overwrite current guardrail settings. You can still tweak them later.
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={cancelPreset}
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

    </ETECard>
  );
}
