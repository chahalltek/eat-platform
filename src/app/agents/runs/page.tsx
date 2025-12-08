import Link from "next/link";
import { Prisma } from "@prisma/client";

import { AgentRunsTable, type AgentRunTableRow } from "./AgentRunsTable";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type LooseRecord = Record<string, unknown>;

type AgentRunRecord = AgentRunTableRow & {
  input: unknown;
  output: unknown;
  sourceType: string | null;
  sourceTag: string | null;
  startedAt: Date;
};

function formatDate(date: Date) {
  return date.toISOString();
}

function getNestedValue(obj: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in (current as LooseRecord)) {
      return (current as LooseRecord)[key];
    }
    return undefined;
  }, obj);
}

function extractCandidateId(log: { input: unknown; output: unknown }) {
  const candidatePaths = [
    ["candidateId"],
    ["candidate", "id"],
    ["snapshot", "candidateId"],
  ];

  for (const source of [log.input, log.output]) {
    for (const path of candidatePaths) {
      const value = getNestedValue(source, path);
      if (typeof value === "string") {
        return value;
      }
    }
  }

  return undefined;
}

function formatStatus(status: string | null) {
  if (!status) return "Unknown";
  const normalized = status.toLowerCase();

  if (normalized === "running") return "Running";
  if (normalized === "success") return "Success";
  if (normalized === "error" || normalized === "failure" || normalized === "failed") return "Failed";
  if (normalized === "partial") return "Partial";

  return status;
}

function formatSource(run: { sourceType: string | null; sourceTag: string | null }) {
  if (run.sourceType && run.sourceTag) {
    return `${run.sourceType} • ${run.sourceTag}`;
  }

  if (run.sourceType) return run.sourceType;
  if (run.sourceTag) return run.sourceTag;
  return "—";
}

function isFailureStatus(status: string | null) {
  const normalized = status?.toLowerCase();
  return normalized === "error" || normalized === "failure" || normalized === "failed";
}

function AgentRunHistory({ runs }: { runs: AgentRunTableRow[] }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Time-ordered history</h2>
        <p className="mt-2 text-sm text-slate-600">No recent runs recorded.</p>
      </div>
    );
  }

  const orderedRuns = [...runs].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Time-ordered history</h2>
          <p className="text-sm text-slate-600">Latest runs with their outcomes.</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Newest first</span>
      </div>

      <ol className="mt-4 space-y-4">
        {orderedRuns.slice(0, 12).map((run) => {
          const failed = isFailureStatus(run.status);
          return (
            <li key={run.id} className="flex gap-3">
              <span
                className={`mt-1.5 h-2.5 w-2.5 rounded-full ${failed ? "bg-red-500" : "bg-emerald-500"}`}
                aria-hidden
              />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{run.agentName}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${failed ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
                  >
                    {run.status ?? "Unknown"}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{new Date(run.startedAt).toLocaleString()}</p>
                <p className="text-xs text-slate-500">Source: {run.source}</p>
                {failed ? (
                  <p className="mt-1 text-xs font-medium text-red-700">Failure surfaced for review.</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default async function AgentRunsPage() {
  const tenantId = await getCurrentTenantId();

  const runs = await prisma.$queryRaw<AgentRunRecord[]>(Prisma.sql`
    SELECT
      id,
      "agentName",
      status::text AS status,
      "startedAt",
      input,
      output,
      "sourceType",
      "sourceTag"
    FROM "AgentRunLog"
    WHERE "tenantId" = ${tenantId}
    ORDER BY "startedAt" DESC
    LIMIT 50
  `);

  const tableRuns: AgentRunTableRow[] = runs.map((run) => ({
    id: run.id,
    agentName: run.agentName,
    status: formatStatus(run.status),
    startedAt: formatDate(run.startedAt),
    candidateId: extractCandidateId({ input: run.input, output: run.output }),
    source: formatSource({ sourceType: run.sourceType, sourceTag: run.sourceTag }),
  }));

  const failedRuns = tableRuns.filter((run) => isFailureStatus(run.status));
  const latestFailure = failedRuns[0];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agent Runs</h1>
          <p className="text-sm text-gray-600">Most recent runs for this tenant.</p>
        </div>
        <Link href="/agents/logs" className="text-blue-600 hover:text-blue-800">
          View detailed logs
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-red-100 bg-red-50 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Failure surfacing</p>
                <h2 className="text-xl font-semibold text-red-900">{failedRuns.length} failures detected</h2>
                <p className="text-sm text-red-800">
                  Reviewing failures quickly helps maintain agent reliability.
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-700">
                Last 50 runs
              </span>
            </div>
            {failedRuns.length === 0 ? (
              <p className="mt-3 text-sm text-red-800">No failures in the latest history.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm text-red-900">
                {failedRuns.slice(0, 3).map((run) => (
                  <li key={run.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2">
                    <div>
                      <p className="font-semibold">{run.agentName}</p>
                      <p className="text-xs text-red-700">Started {new Date(run.startedAt).toLocaleString()}</p>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-red-700">Failed</span>
                  </li>
                ))}
                {latestFailure ? (
                  <li className="text-xs text-red-700">
                    Most recent failure at {new Date(latestFailure.startedAt).toLocaleString()}.
                  </li>
                ) : null}
              </ul>
            )}
          </div>

          <AgentRunsTable runs={tableRuns} />
        </div>

        <div className="lg:col-span-1">
          <AgentRunHistory runs={tableRuns} />
        </div>
      </div>
    </div>
  );
}
