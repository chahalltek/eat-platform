import { computeCandidateConfidenceScore } from '@/lib/candidates/confidenceScore';
import { normalizeMatchExplanation } from '@/lib/matching/explanation';
import { prisma } from '@/lib/prisma';
import { JobMatchesView } from '@/components/JobMatchesView';
import type { ConfidenceDetails, JobMatchRow } from '@/components/JobMatchesTable';

type Props = {
  params: { jobId: string };
};

async function getMatches(jobId: string): Promise<JobMatchRow[]> {
  const jobReq = await prisma.jobReq.findUnique({
    where: { id: jobId },
    include: {
      matchResults: {
        include: {
          candidate: {
            include: {
              skills: {
                select: {
                  id: true,
                  name: true,
                  proficiency: true,
                  yearsOfExperience: true,
                },
              },
            },
          },
        },
        orderBy: { score: 'desc' },
      },
    },
  });

  if (!jobReq) return [];

  return jobReq.matchResults.map((match) => {
    const explanation = normalizeMatchExplanation(match.reasons);
    const confidence =
      typeof match.candidate.trustScore === 'number'
        ? match.candidate.trustScore
        : computeCandidateConfidenceScore({ candidate: match.candidate }).score;

    const explanationSummary =
      explanation.topReasons[0] || explanation.exportableText || '(no explanation summary)';

    const confidenceDetails =
      (match as { confidenceReasons?: ConfidenceDetails | null }).confidenceReasons ?? null;

    return {
      candidateId: match.candidateId,
      candidateName: match.candidate.fullName,
      candidateTitle: match.candidate.currentTitle,
      matchScore: match.score,
      confidence,
      explanationSummary,
      confidenceDetails,
    };
  });
}

export default async function JobMatchesPage({ params }: Props) {
  const data = await getMatches(params.jobId);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <JobMatchesView jobId={params.jobId} initialData={data} />
    </div>
  );
}
