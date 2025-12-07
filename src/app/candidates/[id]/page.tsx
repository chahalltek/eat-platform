import Link from "next/link";

import { prisma } from "@/lib/prisma";

type AgentRunRow = {
  id: string;
  agentName: string;
  startedAt: Date;
};

function formatDate(date?: Date | null) {
  if (!date) return "—";
  return date.toLocaleString();
}

function formatYears(years?: number | null) {
  if (years == null) return "—";
  if (years === 1) return "1 year";
  return `${years} years`;
}

async function findRelatedAgentRun(candidateId: string) {
  const runs = await prisma.$queryRaw<AgentRunRow[]>`
    SELECT id, "agentName", "startedAt"
    FROM "AgentRunLog"
    WHERE input::text ILIKE ${`%${candidateId}%`} OR output::text ILIKE ${`%${candidateId}%`}
    ORDER BY "startedAt" DESC
    LIMIT 1
  `;

  return runs[0];
}

export default async function CandidateDetail({
  params,
}: {
  params: { id: string };
}) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      skills: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          proficiency: true,
          yearsOfExperience: true,
        },
      },
    },
  });

  if (!candidate) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">Candidate</h1>
        <p className="mt-2 text-gray-600">No candidate found.</p>
        <div className="mt-4">
          <Link href="/candidates" className="text-blue-600 hover:text-blue-800">
            Back to candidates
          </Link>
        </div>
      </div>
    );
  }

  const agentRun = await findRelatedAgentRun(candidate.id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{candidate.fullName}</h1>
          <p className="text-gray-600">ID: {candidate.id}</p>
        </div>
        <Link href="/candidates" className="text-blue-600 hover:text-blue-800">
          Back to list
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Title</div>
          <div className="text-lg font-medium text-gray-900">
            {candidate.currentTitle ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Location</div>
          <div className="text-lg font-medium text-gray-900">
            {candidate.location ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Source</div>
          <div className="text-lg font-medium text-gray-900">
            {candidate.sourceType ?? candidate.sourceTag ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Created</div>
          <div className="text-lg font-medium text-gray-900">
            {formatDate(candidate.createdAt)}
          </div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-xs uppercase tracking-wide text-gray-500">Summary</div>
          <div className="mt-1 whitespace-pre-line text-gray-800">
            {candidate.summary ?? "—"}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Skills</h2>
        {candidate.skills.length === 0 ? (
          <p className="mt-2 text-gray-600">No skills recorded.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {candidate.skills.map((skill) => (
              <div key={skill.id} className="rounded-md border border-gray-100 bg-gray-50 p-4">
                <div className="text-sm font-medium text-gray-900">{skill.name}</div>
                <div className="mt-1 text-sm text-gray-700">
                  Proficiency: {skill.proficiency ?? "—"}
                </div>
                <div className="text-sm text-gray-700">
                  Experience: {formatYears(skill.yearsOfExperience)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {agentRun && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Related Agent Run</h2>
          <p className="mt-2 text-gray-700">
            <span className="font-medium">{agentRun.agentName}</span> on {formatDate(agentRun.startedAt)}
          </p>
          <Link
            href={`/agents/runs/${agentRun.id}`}
            className="mt-3 inline-block text-blue-600 hover:text-blue-800"
          >
            View Agent Run
          </Link>
        </div>
      )}
    </div>
  );
}
