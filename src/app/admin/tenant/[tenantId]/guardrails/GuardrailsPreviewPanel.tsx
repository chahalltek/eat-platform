"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BoltIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  ShieldExclamationIcon,
  StopIcon,
} from "@heroicons/react/24/solid";

import type { GuardrailPreviewCandidate, GuardrailPreviewScenario } from "@/lib/guardrails/previewSamples";

type GuardrailPresetConfig = {
  label: string;
  matchCutoff: number;
  minConfidence: number;
  signalWeight: number;
  shortlistLimit: number;
  respectFlags: boolean;
  helper: string;
};

type GuardrailPresetKey = "conservative" | "balanced" | "aggressive";

const PRESET_CONFIG: Record<GuardrailPresetKey, GuardrailPresetConfig> = {
  conservative: {
    label: "Conservative",
    matchCutoff: 82,
    minConfidence: 75,
    signalWeight: 0.8,
    shortlistLimit: 2,
    respectFlags: true,
    helper: "Tighter gates. Prioritizes high-confidence matches and blocks flagged profiles.",
  },
  balanced: {
    label: "Balanced",
    matchCutoff: 72,
    minConfidence: 65,
    signalWeight: 1,
    shortlistLimit: 3,
    respectFlags: true,
    helper: "Default guardrails tuned for mix of speed and control.",
  },
  aggressive: {
    label: "Aggressive",
    matchCutoff: 64,
    minConfidence: 55,
    signalWeight: 1.2,
    shortlistLimit: 4,
    respectFlags: false,
    helper: "Looser filters. Expands shortlist and allows flagged records for review.",
  },
};

const clampScore = (value: number) => Math.max(0, Math.min(100, value));

function evaluateCandidate(
  candidate: GuardrailPreviewCandidate,
  config: {
    matchCutoff: number;
    minConfidence: number;
    signalWeight: number;
    respectFlags: boolean;
  },
) {
  const signalSum = candidate.candidateSignals.senior + candidate.candidateSignals.remote + candidate.candidateSignals.flagged;
  const adjustedMatch = clampScore(candidate.baseMatch + signalSum * config.signalWeight);
  const adjustedConfidence = clampScore(candidate.baseConfidence + signalSum * 0.5 * config.signalWeight);

  const reasons: string[] = [];
  const alerts: string[] = [];

  if (candidate.candidateSignals.flagged < 0) {
    const flagMessage = "Flagged candidate — manual review recommended";
    if (config.respectFlags) {
      reasons.push(flagMessage);
    } else {
      alerts.push(flagMessage);
    }
  }

  if (adjustedMatch < config.matchCutoff) {
    reasons.push(`Below match cutoff (${config.matchCutoff}%)`);
  }

  if (adjustedConfidence < config.minConfidence) {
    reasons.push(`Confidence below ${config.minConfidence}%`);
  }

  return {
    adjustedMatch,
    adjustedConfidence,
    shortlisted: reasons.length === 0,
    reasons,
    alerts,
    signalSum,
  };
}

function applyGuardrails(
  scenario: GuardrailPreviewScenario,
  config: {
    matchCutoff: number;
    minConfidence: number;
    signalWeight: number;
    shortlistLimit: number;
    respectFlags: boolean;
  },
) {
  const evaluated = scenario.candidates.map((candidate) => ({
    candidate,
    evaluation: evaluateCandidate(candidate, config),
  }));

  const shortlisted = evaluated
    .filter((entry) => entry.evaluation.shortlisted)
    .sort((a, b) => b.evaluation.adjustedMatch - a.evaluation.adjustedMatch);

  const finalShortlist = shortlisted.map((entry, index) => {
    const reasons = [...entry.evaluation.reasons];
    const shortlisted = index < config.shortlistLimit;

    if (!shortlisted) {
      reasons.push("Outside shortlist limit");
    }

    return { ...entry, evaluation: { ...entry.evaluation, shortlisted, reasons } };
  });

  const rejected = evaluated
    .filter((entry) => !entry.evaluation.shortlisted)
    .concat(finalShortlist.filter((entry) => !entry.evaluation.shortlisted))
    .map((entry) => ({ ...entry, evaluation: { ...entry.evaluation, shortlisted: false } }));

  const shortlistWithinLimit = finalShortlist.filter((entry) => entry.evaluation.shortlisted);

  return { shortlist: shortlistWithinLimit, rejected };
}

function formatSignal(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "" : "±";
  return `${prefix}${value}`;
}

function ConfigNumberInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  helper,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  helper?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm font-medium text-zinc-800">
        <span>{label}</span>
        <span className="text-xs text-zinc-500">{min}–{max}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-indigo-100 accent-indigo-600"
      />
      <div className="flex items-center justify-between text-xs text-zinc-600">
        <span className="font-semibold text-zinc-900">{value}%</span>
        {helper ? <span>{helper}</span> : null}
      </div>
    </label>
  );
}

function PresetPill({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
      Applied
    </span>
  );
}

export function GuardrailsPreviewPanel({ tenantId }: { tenantId: string }) {
  const [sampleShortlist, setSampleShortlist] = useState("sample5");
  const [scenario, setScenario] = useState<GuardrailPreviewScenario | null>(null);
  const [availableSamples, setAvailableSamples] = useState<Array<{ sampleShortlist: string; label: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [preset, setPreset] = useState<GuardrailPresetKey>("balanced");
  const [config, setConfig] = useState<GuardrailPresetConfig>({ ...PRESET_CONFIG.balanced });

  useEffect(() => {
    async function loadScenario() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/admin/tenant/${encodeURIComponent(tenantId)}/guardrails/preview?sampleShortlist=${encodeURIComponent(sampleShortlist)}`,
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: "Unable to load sample shortlist" }));
          throw new Error(payload.error ?? "Unable to load sample shortlist");
        }

        const payload = (await response.json()) as {
          scenario: GuardrailPreviewScenario;
          availableSamples: Array<{ sampleShortlist: string; label: string }>;
        };

        setScenario(payload.scenario);
        setAvailableSamples(payload.availableSamples ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load sample shortlist";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadScenario();
  }, [sampleShortlist, tenantId, refreshIndex]);

  const { shortlist, rejected } = useMemo(() => {
    if (!scenario) return { shortlist: [], rejected: [] };
    return applyGuardrails(scenario, config);
  }, [scenario, config]);

  const isModified = useMemo(() => {
    const presetConfig = PRESET_CONFIG[preset];
    return (
      presetConfig.matchCutoff !== config.matchCutoff ||
      presetConfig.minConfidence !== config.minConfidence ||
      presetConfig.signalWeight !== config.signalWeight ||
      presetConfig.shortlistLimit !== config.shortlistLimit ||
      presetConfig.respectFlags !== config.respectFlags
    );
  }, [config, preset]);

  function handlePresetChange(key: keyof typeof PRESET_CONFIG) {
    setPreset(key);
    setConfig({ ...PRESET_CONFIG[key] });
    setError(null);
  }

  function resetPreset() {
    setConfig({ ...PRESET_CONFIG[preset] });
    setError(null);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <section className="lg:col-span-2 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <header className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Config</p>
            <h2 className="text-xl font-semibold text-zinc-900">Guardrail presets</h2>
          </div>
          {isModified ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">Modified</span>
          ) : (
            <PresetPill active />
          )}
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(Object.keys(PRESET_CONFIG) as Array<keyof typeof PRESET_CONFIG>).map((key) => {
            const presetConfig = PRESET_CONFIG[key];
            const active = preset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handlePresetChange(key)}
                className={`flex min-w-0 flex-col items-start gap-2 rounded-xl border p-3 text-left shadow-sm transition ${
                  active
                    ? "border-indigo-200 bg-indigo-50 text-indigo-900"
                    : "border-zinc-200 bg-white text-zinc-800 hover:border-indigo-100 hover:bg-indigo-50"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <BoltIcon className={`h-5 w-5 ${active ? "text-indigo-600" : "text-zinc-400"}`} />
                  <span className="text-sm font-semibold leading-tight break-words">{presetConfig.label}</span>
                </div>
                <p className="text-xs text-zinc-600">{presetConfig.helper}</p>
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  <span>Match ≥ {presetConfig.matchCutoff}%</span>
                  <span>Conf ≥ {presetConfig.minConfidence}%</span>
                  <span>Limit {presetConfig.shortlistLimit}</span>
                </div>
                {active ? <PresetPill active /> : null}
              </button>
            );
          })}
        </div>

        <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-between text-sm font-semibold text-zinc-800">
            <span>Manual overrides</span>
            <button
              type="button"
              onClick={resetPreset}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Reset to preset
            </button>
          </div>
          <div className="space-y-3">
            <ConfigNumberInput
              label="Match cutoff"
              value={config.matchCutoff}
              min={50}
              max={95}
              onChange={(value) => setConfig((current) => ({ ...current, matchCutoff: value }))}
              helper="Blocks below this score"
            />
            <ConfigNumberInput
              label="Confidence floor"
              value={config.minConfidence}
              min={40}
              max={90}
              onChange={(value) => setConfig((current) => ({ ...current, minConfidence: value }))}
              helper="Requires reliable signals"
            />
            <ConfigNumberInput
              label="Signal weight"
              value={Math.round(config.signalWeight * 100)}
              min={40}
              max={140}
              step={5}
              onChange={(value) => setConfig((current) => ({ ...current, signalWeight: value / 100 }))}
              helper="Influence from extra signals"
            />
            <div className="flex items-center justify-between rounded-lg bg-white px-3 py-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Shortlist limit</p>
                <p className="text-xs text-zinc-600">Maximum profiles surfaced</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfig((current) => ({ ...current, shortlistLimit: Math.max(1, current.shortlistLimit - 1) }))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-lg font-semibold text-zinc-700"
                  aria-label="Decrease shortlist limit"
                >
                  −
                </button>
                <span className="min-w-[32px] text-center text-base font-semibold text-zinc-900">{config.shortlistLimit}</span>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((current) => ({ ...current, shortlistLimit: Math.min(6, current.shortlistLimit + 1) }))
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-lg font-semibold text-zinc-700"
                  aria-label="Increase shortlist limit"
                >
                  +
                </button>
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-lg bg-white px-3 py-3 text-sm font-medium text-zinc-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600"
                checked={config.respectFlags}
                onChange={(event) => setConfig((current) => ({ ...current, respectFlags: event.target.checked }))}
              />
              Block flagged candidates from shortlist
            </label>
          </div>
        </div>
      </section>

      <section className="lg:col-span-3 space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Preview</p>
              <h2 className="text-xl font-semibold text-zinc-900">Sample shortlist</h2>
              <p className="text-sm text-zinc-600">Compare how presets affect the same candidate slate.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-zinc-800">
                Scenario
                <select
                  className="ml-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm focus:border-indigo-400 focus:outline-none"
                  value={sampleShortlist}
                  onChange={(event) => setSampleShortlist(event.target.value)}
                >
                  {availableSamples.length === 0 ? (
                    <option value="sample5">Sample shortlist (5 candidates)</option>
                  ) : (
                    availableSamples.map((sample) => (
                      <option key={sample.sampleShortlist} value={sample.sampleShortlist}>
                        {sample.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>
          </div>

          {error ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <ExclamationTriangleIcon className="h-5 w-5 flex-none" />
              <div className="flex-1">
                <p className="font-semibold">Preview unavailable</p>
                <p className="text-amber-800">{error}</p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-amber-900 underline"
                onClick={() => setRefreshIndex((current) => current + 1)}
              >
                Retry
              </button>
            </div>
          ) : null}

          {scenario ? (
            <div className="mt-4 space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-700">
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-800">
                  {scenario.jobTitle}
                </span>
                <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700">
                  {scenario.seniority}
                </span>
                <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700">
                  {scenario.location}
                </span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Skill match {scenario.skillMatch}%
                </span>
              </div>
              <p className="text-sm text-zinc-700">{scenario.description}</p>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircleIcon className="h-5 w-5" />
                  <h3 className="text-base font-semibold">Shortlisted ({shortlist.length})</h3>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Limit {config.shortlistLimit}
                </span>
              </div>
              <div className="space-y-2">
                {isLoading ? <p className="text-sm text-emerald-900">Loading preview…</p> : null}
                {!isLoading && shortlist.length === 0 ? (
                  <p className="text-sm text-emerald-900">No candidates meet the guardrails.</p>
                ) : null}
                {shortlist.map(({ candidate, evaluation }) => (
                  <div key={candidate.id} className="rounded-lg bg-white px-3 py-2 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-900">{candidate.name}</p>
                        <p className="text-xs text-zinc-600">{candidate.title}</p>
                      </div>
                      <div className="text-right text-xs text-zinc-600">
                        <p className="font-semibold text-zinc-900">Match {Math.round(evaluation.adjustedMatch)}%</p>
                        <p>Confidence {Math.round(evaluation.adjustedConfidence)}%</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">
                        Signals {formatSignal(evaluation.signalSum)}
                      </span>
                      <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-800">
                        Match ≥ {config.matchCutoff}%
                      </span>
                      <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-800">
                        Confidence ≥ {config.minConfidence}%
                      </span>
                      {evaluation.alerts.map((alert) => (
                        <span key={alert} className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-800">
                          <ShieldExclamationIcon className="h-4 w-4" />
                          {alert}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-rose-100 bg-rose-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-rose-800">
                  <StopIcon className="h-5 w-5" />
                  <h3 className="text-base font-semibold">Rejected ({rejected.length})</h3>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-rose-700">Guardrails applied</span>
              </div>
              <div className="space-y-2">
                {isLoading ? <p className="text-sm text-rose-900">Loading preview…</p> : null}
                {!isLoading && rejected.length === 0 ? (
                  <p className="text-sm text-rose-900">No candidates are blocked.</p>
                ) : null}
                {rejected.map(({ candidate, evaluation }) => (
                  <div key={candidate.id} className="rounded-lg bg-white px-3 py-2 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-900">{candidate.name}</p>
                        <p className="text-xs text-zinc-600">{candidate.title}</p>
                      </div>
                      <div className="text-right text-xs text-zinc-600">
                        <p className="font-semibold text-zinc-900">Match {Math.round(evaluation.adjustedMatch)}%</p>
                        <p>Confidence {Math.round(evaluation.adjustedConfidence)}%</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                      {evaluation.reasons.map((reason) => (
                        <span key={reason} className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1">
                          <FunnelIcon className="h-4 w-4" />
                          {reason}
                        </span>
                      ))}
                      {evaluation.alerts.map((alert) => (
                        <span key={alert} className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-800">
                          <ShieldExclamationIcon className="h-4 w-4" />
                          {alert}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
