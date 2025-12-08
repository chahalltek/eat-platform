<<<<<<< ours
import { prisma } from '@/src/lib/prisma';
import { JobMatchesView } from '@/src/components/JobMatchesView';
import type { JobMatchRow } from '@/src/components/JobMatchesTable';
=======
import { prisma } from '@/lib/prisma';
import { JobMatchesTable, JobMatchRow } from '@/components/JobMatchesTable';
>>>>>>> theirs

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
    <div className="max-w-4xl mx-auto py-8">
      <JobMatchesView jobId={params.jobId} initialData={data} />
    </div>
  );
}
