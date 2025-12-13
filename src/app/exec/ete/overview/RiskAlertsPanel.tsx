"use client";

import { useEffect, useState } from "react";

import { ExclamationTriangleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

type RiskResponse = {
  risks?: { jobId: string; jobTitle?: string | null; riskFlags?: string[] }[];
  error?: string;
};

type RiskItem = NonNullable<RiskResponse["risks"]>[number];

function buildDisplayLabel(risk: RiskItem) {
  if (risk.jobTitle && risk.jobTitle.trim().length > 0) {
    return risk.jobTitle;
  }
  return risk.jobId;
}

export function RiskAlertsPanel() {
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadRisks() {
      try {
        const response = await fetch("/api/ete/forecast/time-to-fill");
        const body: RiskResponse = await response.json();

        if (!response.ok || !Array.isArray(body.risks) || body.risks.length === 0) {
          setStatus("unavailable");
          setMessage(body.error ?? "Forecasts unavailable. Risk flags are hidden until forecasting resumes.");
          setRisks([]);
          return;
        }

        setRisks(body.risks.slice(0, 3));
        setStatus("ready");
      } catch (error) {
        console.error("[exec-overview] failed to load risk alerts", error);
        setStatus("unavailable");
        setMessage("Forecasts unavailable. Risk flags are hidden until forecasting resumes.");
      }
    }

    void loadRisks();
  }, []);

  return (
    <div className="lg:col-span-2 space-y-4 rounded-3xl border border-rose-100 bg-rose-50/70 p-6 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/30">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-200">Top hiring risks</p>
          <h2 className="text-lg font-semibold text-rose-900 dark:text-rose-50">Forecasted slippage</h2>
          <p className="text-sm text-rose-900/80 dark:text-rose-100/80">From L2 forecasts and recent funnel health.</p>
        </div>
        <ShieldCheckIcon className="h-6 w-6 text-rose-700 dark:text-rose-200" aria-hidden />
      </div>

      {status === "loading" ? (
        <p className="text-sm text-rose-900/80 dark:text-rose-100/80">Loading risk signals…</p>
      ) : null}

      {status === "unavailable" ? (
        <div className="rounded-2xl bg-white/70 p-4 text-sm text-rose-900/80 ring-1 ring-rose-100 shadow-sm dark:bg-rose-950/60 dark:text-rose-100/80 dark:ring-rose-900/60">
          {message ?? "Risk signals are unavailable right now."}
        </div>
      ) : null}

      {status === "ready" ? (
        <div className="space-y-3">
          {risks.map((risk) => (
            <div key={risk.jobId} className="space-y-1 rounded-2xl bg-white/70 p-4 ring-1 ring-rose-100 shadow-sm dark:bg-rose-950/60 dark:ring-rose-900/60">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-900 dark:text-rose-100">
                <ExclamationTriangleIcon className="h-5 w-5" aria-hidden />
                {buildDisplayLabel(risk)}
              </div>
              <p className="text-sm text-rose-900/80 dark:text-rose-100/80">
                {risk.riskFlags?.[0] ?? "This requisition has elevated time-to-fill risk."}
              </p>
              <p className="text-[13px] font-medium text-rose-800 dark:text-rose-200">
                Risk flags are limited to three highest severity forecasts.
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <a
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-semibold text-rose-800 underline decoration-rose-200 decoration-2 underline-offset-4 hover:text-rose-900 dark:text-rose-100 dark:hover:text-rose-50"
      >
        Open risk dashboard
      </a>
    </div>
  );
}
