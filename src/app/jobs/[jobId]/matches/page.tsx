import { prisma } from '@/src/lib/prisma';
import { JobMatchesTable, JobMatchRow } from '@/src/components/JobMatchesTable';

type Props = {
  params: { jobId: string };
};

async function getMatches(jobId: string): Promise<JobMatchRow[]> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      matches: {
        include: {
          candidate: true,
        },
        orderBy: { matchScore: 'desc' },
      },
    },
  });

  if (!job) return [];

  return job.matches.map((m) => ({
    candidateId: m.candidateId,
    candidateName: m.candidate.fullName,
    candidateTitle: m.candidate.primaryTitle,
    matchScore: m.matchScore,
    confidence: m.confidence,
    explanationSummary:
      (m.explanation as any)?.summary ?? '(no explanation summary)',
  }));
}

export default async function JobMatchesPage({ params }: Props) {
  const data = await getMatches(params.jobId);

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Matches for job: {params.jobId}
        </h1>
        {/* For now, you can manually hit the POST /api/jobs/[jobId]/matcher
            via curl or add a button wired to that endpoint later */}
      </div>

      <JobMatchesTable data={data} />

      <p className="text-xs text-slate-500">
        Tip: run the MATCHER via
        <code className="mx-1 rounded bg-slate-100 px-1">
          POST /api/jobs/{params.jobId}/matcher
        </code>
        to refresh these results.
      </p>
    </div>
  );
}
