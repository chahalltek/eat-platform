import Link from "next/link";

import { recordHealthCheck, runHealthChecks } from "@/lib/health";
<<<<<<< ours
import { StatusPill, type Status } from "@/components/StatusPill";

function healthStatusToPill(status: "ok" | "error"): Status {
  return status === "ok" ? "healthy" : "down";
}
=======
import { EATCard } from "@/components/EATCard";
import { StatusPill } from "@/components/StatusPill";
>>>>>>> theirs

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

<<<<<<< ours
        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={healthStatusToPill(report.status)} label={report.status === "ok" ? "Healthy" : "Unhealthy"} />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Last checked at {new Date(report.timestamp).toLocaleString()}
            </span>
=======
        <EATCard className="gap-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill
                status={report.status === "ok" ? "ok" : "error"}
                label={report.status === "ok" ? "Healthy" : "Unhealthy"}
              />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Last checked at {new Date(report.timestamp).toLocaleString()}
              </span>
            </div>
>>>>>>> theirs
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {report.checks.map((check) => (
              <EATCard
                key={check.name}
                className="gap-3 border-zinc-100 bg-zinc-50 transition-none hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">{check.name}</p>
                    <h2 className="text-lg font-semibold capitalize text-zinc-900 dark:text-zinc-50">{check.name}</h2>
                  </div>
<<<<<<< ours
                  <StatusPill status={healthStatusToPill(check.status)} label={check.status === "ok" ? "Pass" : "Fail"} />
=======
                  <StatusPill
                    status={check.status === "ok" ? "ok" : "error"}
                    label={check.status === "ok" ? "Pass" : "Fail"}
                  />
>>>>>>> theirs
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{check.message}</p>
              </EATCard>
            ))}
          </div>
        </EATCard>
      </main>
    </div>
  );
}
