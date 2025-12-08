import Link from "next/link";

import { recordHealthCheck, runHealthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const report = await runHealthChecks();

  try {
    await recordHealthCheck(report);
  } catch (error) {
    console.error("[health] Failed to persist AgentRunLog", error);
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-14 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
              EAT
            </p>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">System Health</h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Live snapshot of infrastructure and dependency checks.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 hover:shadow-sm dark:border-zinc-800 dark:text-zinc-100 dark:hover:border-indigo-600/60 dark:hover:text-indigo-200"
          >
            Back home
          </Link>
        </div>

        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                report.status === "ok"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                  : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
              }`}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-current" aria-hidden />
              {report.status === "ok" ? "Healthy" : "Unhealthy"}
            </span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Last checked at {new Date(report.timestamp).toLocaleString()}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {report.checks.map((check) => (
              <div
                key={check.name}
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">{check.name}</p>
                    <h2 className="text-lg font-semibold capitalize">{check.name}</h2>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      check.status === "ok"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                        : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                    }`}
                  >
                    {check.status === "ok" ? "Pass" : "Fail"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{check.message}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
