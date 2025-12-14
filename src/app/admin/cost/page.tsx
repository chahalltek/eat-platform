import { BanknotesIcon, ShieldCheckIcon, SparklesIcon } from "@heroicons/react/24/outline";
import type { CostDriverType } from "@/server/db";

import { getCurrentUser } from "@/lib/auth/user";
import { isAdminOrDataAccessRole } from "@/lib/auth/roles";
import { formatCostValue, getMonthlyCostSnapshots } from "@/lib/cost/summary";

const DRIVER_LABELS: Record<CostDriverType, string> = {
  LLM_CALL: "LLM calls",
  FORECAST_RUNTIME: "Forecast job runtime",
  AGGREGATION_RUNTIME: "Aggregation job runtime",
};

export default async function CostPage() {
  const user = await getCurrentUser();

  if (!isAdminOrDataAccessRole(user?.role)) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm">
          <ShieldCheckIcon className="h-6 w-6" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold">Admin access required</h1>
            <p className="text-sm text-amber-800">Switch to an admin account to view cost drivers.</p>
          </div>
        </div>
      </div>
    );
  }

  const snapshots = await getMonthlyCostSnapshots();
  const monthStart = snapshots[0]?.monthStart ?? new Date();
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
          <BanknotesIcon className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Cost</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Intelligence cost observability</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Reporting-only view to highlight where LLM and intelligence workloads generate spend before we optimize.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-900/40 dark:text-emerald-50">
          <p className="font-semibold">Cost drivers visible</p>
          <p className="text-emerald-800/80 dark:text-emerald-100/80">LLM calls, forecasts, and aggregation jobs are tagged.</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-900/30 dark:text-amber-50">
          <p className="font-semibold">No billing yet</p>
          <p className="text-amber-800/80 dark:text-amber-100/80">Metrics are for observability only; pricing not enforced.</p>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-900/30 dark:text-indigo-50">
          <SparklesIcon className="mt-0.5 h-5 w-5" aria-hidden />
          <div>
            <p className="font-semibold">Ready for optimization</p>
            <p className="text-indigo-800/80 dark:text-indigo-100/80">SKUs and features are captured so we can tune later.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">{monthLabel}</span>
          <span className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Reporting only</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-300">
              <tr>
                <th className="px-6 py-3">Tenant</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3 text-right">Observed</th>
                <th className="px-4 py-3 text-right">Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white text-zinc-800 dark:divide-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
              {snapshots.length === 0 ? (
                <tr>
                  <td className="px-6 py-4 text-zinc-500" colSpan={6}>
                    No cost telemetry recorded for this month.
                  </td>
                </tr>
              ) : (
                snapshots.map((snapshot, index) => (
                  <tr key={`${snapshot.tenantId ?? "platform"}-${snapshot.driver}-${index}`}>
                    <td className="px-6 py-4 font-medium">{snapshot.tenantName}</td>
                    <td className="px-4 py-4">{DRIVER_LABELS[snapshot.driver]}</td>
                    <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">{snapshot.sku ?? "—"}</td>
                    <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">{snapshot.feature ?? "—"}</td>
                    <td className="px-4 py-4 text-right font-semibold tabular-nums">{formatCostValue(snapshot)}</td>
                    <td className="px-4 py-4 text-right text-zinc-600 dark:text-zinc-300">{snapshot.eventCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
