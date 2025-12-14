import { ChartBarIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

import { getCurrentUser } from "@/lib/auth/user";
import { isAdminOrDataAccessRole } from "@/lib/auth/roles";
import { getMonthlyUsageSnapshots } from "@/lib/usage/summary";

const DIMENSION_LABELS = {
  JOBS_PROCESSED: "Jobs processed",
  CANDIDATES_EVALUATED: "Candidates evaluated",
  AGENT_RUN: "Agent runs",
  EXPLAIN_CALL: "EXPLAIN calls",
  COPILOT_CALL: "Copilot calls",
} as const;

export default async function UsagePage() {
  const user = await getCurrentUser();

  if (!isAdminOrDataAccessRole(user?.role)) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm">
          <ShieldCheckIcon className="h-6 w-6" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold">Admin access required</h1>
            <p className="text-sm text-amber-800">Switch to an admin account to view usage metering.</p>
          </div>
        </div>
      </div>
    );
  }

  const snapshots = await getMonthlyUsageSnapshots();
  const monthStart = snapshots[0]?.monthStart ?? new Date();
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-100">
          <ChartBarIcon className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Usage</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Monthly metering</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Reporting only — captures ETE commercial dimensions per tenant.</p>
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
                {Object.values(DIMENSION_LABELS).map((label) => (
                  <th key={label} className="px-4 py-3 text-right">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white text-zinc-800 dark:divide-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
              {snapshots.length === 0 ? (
                <tr>
                  <td className="px-6 py-4 text-zinc-500" colSpan={1 + Object.keys(DIMENSION_LABELS).length}>
                    No usage recorded for this month.
                  </td>
                </tr>
              ) : (
                snapshots.map((snapshot) => (
                  <tr key={snapshot.tenantId}>
                    <td className="px-6 py-4 font-medium">{snapshot.tenantName}</td>
                    {Object.keys(DIMENSION_LABELS).map((dimensionKey) => (
                      <td key={dimensionKey} className="px-4 py-4 text-right font-semibold tabular-nums">
                        {snapshot.totals[dimensionKey as keyof typeof DIMENSION_LABELS] ?? 0}
                      </td>
                    ))}
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
