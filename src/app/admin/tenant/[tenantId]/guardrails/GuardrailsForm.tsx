"use client";

import { useEffect, useMemo, useState } from "react";

import { defaultTenantGuardrails, type TenantGuardrails } from "@/lib/tenant/guardrails";

type GuardrailsResponse = { guardrails: TenantGuardrails };

type Status = { variant: "success" | "error" | "info"; message: string } | null;

function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  helper,
}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  helper?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-zinc-700">
      <span className="font-medium text-zinc-800">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        min={min}
        step={step}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
      {helper ? <span className="text-xs text-zinc-500">{helper}</span> : null}
    </label>
  );
}

export function GuardrailsForm({ tenantId }: { tenantId: string }) {
  const [form, setForm] = useState<TenantGuardrails>(defaultTenantGuardrails);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const disabled = saving || loading;

  const fetchConfig = async () => {
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch(`/api/admin/tenant/${tenantId}/guardrails`, { method: "GET" });

      if (!response.ok) {
        throw new Error((await response.json())?.error ?? "Failed to load guardrails");
      }

      const data = (await response.json()) as GuardrailsResponse;
      setForm(data.guardrails ?? defaultTenantGuardrails);
    } catch (error) {
      setStatus({ variant: "error", message: (error as Error).message });
      setForm(defaultTenantGuardrails);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const updateField = (path: (keyof TenantGuardrails | string)[], value: unknown) => {
    setForm((previous) => {
      const clone = structuredClone(previous);
      let cursor: any = clone;

      for (let i = 0; i < path.length - 1; i += 1) {
        const key = path[i];
        cursor[key] = cursor[key] ?? {};
        cursor = cursor[key];
      }

      cursor[path[path.length - 1]] = value;

      return clone;
    });
  };

  const handleSave = async (nextConfig?: TenantGuardrails) => {
    setSaving(true);
    setStatus(null);

    try {
      const payload = nextConfig ?? form;
      const response = await fetch(`/api/admin/tenant/${tenantId}/guardrails`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to save guardrails");
      }

      setForm(body.guardrails ?? payload);
      setStatus({ variant: "success", message: "Guardrails saved" });
    } catch (error) {
      setStatus({ variant: "error", message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const defaults = structuredClone(defaultTenantGuardrails);
    setForm(defaults);
    await handleSave(defaults);
  };

  const banner = useMemo(() => {
    if (!status) return null;

    const tone: Record<NonNullable<Status>["variant"], string> = {
      success: "border-green-200 bg-green-50 text-green-900",
      error: "border-rose-200 bg-rose-50 text-rose-900",
      info: "border-sky-200 bg-sky-50 text-sky-900",
    };

    return (
      <div className={`rounded-lg border px-4 py-3 text-sm ${tone[status.variant]}`}>
        {status.message}
      </div>
    );
  }, [status]);

  return (
    <div className="space-y-6">
      {banner}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900">Scoring strategy</h3>
          <p className="text-sm text-zinc-600">Choose whether to use a simple or weighted scoring approach.</p>
          <div className="flex gap-4">
            {(["simple", "weighted"] as const).map((strategy) => (
              <label key={strategy} className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="radio"
                  name="strategy"
                  value={strategy}
                  checked={form.scoring.strategy === strategy}
                  disabled={disabled}
                  onChange={() => updateField(["scoring", "strategy"], strategy)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="capitalize">{strategy}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900">Explainability</h3>
          <p className="text-sm text-zinc-600">Control how much detail appears in match explanations.</p>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            <span className="font-medium text-zinc-800">Explanation level</span>
            <select
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              value={form.explain.level}
              disabled={disabled}
              onChange={(event) => updateField(["explain", "level"], event.target.value)}
            >
              <option value="compact">Compact</option>
              <option value="detailed">Detailed</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={form.explain.includeWeights}
              disabled={disabled}
              onChange={(event) => updateField(["explain", "includeWeights"], event.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            Include weights in explanations
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-zinc-900">Weights</h3>
            <p className="text-sm text-zinc-600">Adjust how strongly each category influences the score.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput
              label="Must-have skills"
              value={form.scoring.weights.mustHaveSkills}
              onChange={(value) => updateField(["scoring", "weights", "mustHaveSkills"], value)}
              helper="Higher values increase the impact of required skills."
            />
            <NumberInput
              label="Nice-to-have skills"
              value={form.scoring.weights.niceToHaveSkills}
              onChange={(value) => updateField(["scoring", "weights", "niceToHaveSkills"], value)}
            />
            <NumberInput
              label="Experience"
              value={form.scoring.weights.experience}
              onChange={(value) => updateField(["scoring", "weights", "experience"], value)}
            />
            <NumberInput
              label="Location"
              value={form.scoring.weights.location}
              onChange={(value) => updateField(["scoring", "weights", "location"], value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-zinc-900">Thresholds</h3>
            <p className="text-sm text-zinc-600">Guardrails for screening and shortlisting.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput
              label="Min match score"
              value={form.scoring.thresholds.minMatchScore}
              onChange={(value) => updateField(["scoring", "thresholds", "minMatchScore"], value)}
              helper="Minimum score before a candidate is considered."
            />
            <NumberInput
              label="Shortlist min score"
              value={form.scoring.thresholds.shortlistMinScore}
              onChange={(value) => updateField(["scoring", "thresholds", "shortlistMinScore"], value)}
            />
            <NumberInput
              label="Shortlist max candidates"
              value={form.scoring.thresholds.shortlistMaxCandidates}
              min={1}
              step={1}
              onChange={(value) => updateField(["scoring", "thresholds", "shortlistMaxCandidates"], value)}
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Safety</h3>
        <p className="text-sm text-zinc-600">Apply safety rules when ranking candidates.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={form.safety.requireMustHaves}
              disabled={disabled}
              onChange={(event) => updateField(["safety", "requireMustHaves"], event.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            Require must-have skills
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={form.safety.excludeInternalCandidates}
              disabled={disabled}
              onChange={(event) => updateField(["safety", "excludeInternalCandidates"], event.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            Exclude internal candidates
          </label>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-zinc-900">Actions</h3>
          <p className="text-sm text-zinc-600">Save changes or restore the defaults for this tenant.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={disabled}
            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={disabled}
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 disabled:cursor-not-allowed disabled:border-zinc-200"
          >
            Reset to defaults
          </button>
          {loading ? <p className="text-sm text-zinc-500">Loading guardrails…</p> : null}
        </div>
      </div>
    </div>
  );
}
