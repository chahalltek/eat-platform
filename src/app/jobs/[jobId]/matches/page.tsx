<<<<<<< ours
import { computeCandidateConfidenceScore } from '@/lib/candidates/confidenceScore';
import { normalizeMatchExplanation } from '@/lib/matching/explanation';
import { prisma } from '@/lib/prisma';
import { JobMatchesView } from '@/components/JobMatchesView';
import type { ConfidenceDetails, JobMatchRow } from '@/components/JobMatchesTable';
=======
import { prisma } from "@/lib/prisma";
import { JobMatchesView } from "@/components/JobMatchesView";
import type { JobMatchRow } from "@/components/JobMatchesTable";
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
        orderBy: { matchScore: "desc" },
      },
    },
  });

  if (!job) return [];

  return job.matches.map((m) => {
    const explanation: any = m.explanation ?? {};
    const confidenceReasons: any = (m as any).confidenceReasons ?? null;

    const confidenceDetails =
      (match as { confidenceReasons?: ConfidenceDetails | null }).confidenceReasons ?? null;

    return {
<<<<<<< ours
      candidateId: match.candidateId,
      candidateName: match.candidate.fullName,
      candidateTitle: match.candidate.currentTitle,
      matchScore: match.score,
      confidence,
      explanationSummary,
      confidenceDetails,
=======
      candidateId: m.candidateId,
      candidateName: m.candidate.fullName,
      candidateTitle: m.candidate.currentTitle,
      matchScore: m.matchScore,
      confidence: m.confidence,
      explanationSummary: explanation.summary ?? "(no explanation summary)",
      confidenceDetails: confidenceReasons
        ? {
            dataCompleteness: confidenceReasons.dataCompleteness ?? 0,
            skillCoverage: confidenceReasons.skillCoverage ?? 0,
            recency: confidenceReasons.recency ?? 0,
          }
        : null,
>>>>>>> theirs
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
