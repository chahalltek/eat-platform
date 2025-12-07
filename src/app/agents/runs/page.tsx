import Link from "next/link";
import { prisma } from "@/lib/prisma";

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

export default async function AgentRunsPage() {
  const runs = await prisma.agentRunLog.findMany({
    select: {
      id: true,
      agentName: true,
      status: true,
      startedAt: true,
      input: true,
      output: true,
    },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

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
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {candidateId ?? "—"}
                  </td>
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
