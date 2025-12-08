"use client";

import type React from "react";
import { useState } from "react";

type PlanOption = { id: string; name: string };

type TenantPlanEditorProps = {
  tenantId: string;
  tenantName: string;
  status: string;
  currentPlanId: string | null;
  currentPlanName: string | null;
  isTrial: boolean;
  trialEndsAt: string | null;
  plans: PlanOption[];
};

export function TenantPlanEditor({
  tenantId,
  tenantName,
  status,
  currentPlanId,
  currentPlanName,
  isTrial,
  trialEndsAt,
  plans,
}: TenantPlanEditorProps) {
  const [selectedPlan, setSelectedPlan] = useState(currentPlanId ?? plans[0]?.id ?? "");
  const [trial, setTrial] = useState<boolean>(Boolean(isTrial));
  const [trialEnd, setTrialEnd] = useState(trialEndsAt ? trialEndsAt.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayPlan, setDisplayPlan] = useState(currentPlanName ?? "No plan assigned");
  const [displayTrialEnd, setDisplayTrialEnd] = useState<string | null>(trialEndsAt);
  const [displayTrial, setDisplayTrial] = useState<boolean>(Boolean(isTrial));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/admin/tenants/${tenantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: selectedPlan,
        isTrial: trial,
        trialEndsAt: trialEnd ? new Date(trialEnd).toISOString() : null,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload?.error ?? "Unable to update plan");
      setSaving(false);
      return;
    }

    const payload = await response.json();
    const tenant = payload.tenant;

    setDisplayPlan(tenant.plan?.name ?? "No plan assigned");
    setDisplayTrial(Boolean(tenant.isTrial));
    setDisplayTrialEnd(tenant.trialEndsAt);
    setMessage("Plan updated successfully");
    setSaving(false);
  }

  return (
    <section className="space-y-4" aria-label="Tenant plan editor">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Tenant</p>
            <h2 className="text-2xl font-semibold text-gray-900">{tenantName}</h2>
            <p className="text-sm text-gray-600">Status: {status}</p>
            <p className="mt-2 text-sm text-gray-700">
              Current plan: <span className="font-semibold">{displayPlan}</span>
            </p>
            <p className="text-sm text-gray-700">
              Trial: {displayTrial ? "Yes" : "No"}
              {displayTrialEnd ? ` (ends ${new Date(displayTrialEnd).toLocaleDateString()})` : ""}
            </p>
          </div>
          <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Plan controls</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <label htmlFor="plan" className="block text-sm font-medium text-gray-900">
            Assign plan
          </label>
          <select
            id="plan"
            name="plan"
            value={selectedPlan}
            onChange={(event) => setSelectedPlan(event.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-900">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={trial}
              onChange={(event) => setTrial(event.target.checked)}
            />
            Trial enabled
          </label>

          <div className="flex flex-col text-sm text-gray-700">
            <label htmlFor="trial-end" className="text-sm font-medium text-gray-900">
              Trial end date
            </label>
            <input
              id="trial-end"
              type="date"
              value={trialEnd}
              onChange={(event) => setTrialEnd(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={saving || !selectedPlan}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          {message && (
            <span className="text-sm font-medium text-green-700" role="status">
              {message}
            </span>
          )}
          {error && (
            <span className="text-sm font-medium text-red-700" role="alert">
              {error}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
