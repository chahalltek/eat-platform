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

      <div className="mt-6">
        <AgentRunsTable runs={tableRuns} />
      </div>
    </div>
  );
}
