import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type LooseRecord = Record<string, unknown>;

function formatDate(date: Date) {
  return date.toLocaleString();
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

type AgentRunRow = {
  id: string;
  agentName: string;
  status: string | null;
  startedAt: Date;
  input: unknown;
  output: unknown;
  sourceType: string | null;
  sourceTag: string | null;
};

function formatStatus(status: string | null) {
  if (!status) return "Unknown";
  const normalized = status.toLowerCase();

  if (normalized === "running") return "Running";
  if (normalized === "success") return "Success";
  if (normalized === "error" || normalized === "failure") return "Error";

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

export default async function AgentRunsPage() {
  const tenantId = await getCurrentTenantId();

  const runs = await prisma.$queryRaw<AgentRunRow[]>(Prisma.sql`
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Agent Runs</h1>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm text-gray-700">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold text-gray-900">
                Created At
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-gray-900">
                Agent Name
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-gray-900">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-gray-900">
                Candidate ID
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-gray-900">
                Source
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-gray-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {runs.map((run) => {
              const candidateId = extractCandidateId(run);

              return (
                <tr key={run.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">
                    {formatDate(run.startedAt)}
                  </td>
                  <td className="px-4 py-3">{run.agentName}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {formatStatus(run.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {candidateId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatSource(run)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/agents/runs/${run.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
