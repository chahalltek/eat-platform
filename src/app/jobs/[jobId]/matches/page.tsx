import { prisma } from "@/lib/prisma";
import { JobMatchesView } from "@/components/JobMatchesView";
import type {
  ConfidenceDetails,
  ConfidenceReasons,
  JobMatchRow,
} from "@/components/JobMatchesTable";

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
    const confidenceReasons: ConfidenceReasons | null =
      (m as any).confidenceReasons ?? null;

    const confidenceDetails: ConfidenceDetails | null = confidenceReasons
      ? {
          dataCompleteness: confidenceReasons.dataCompleteness ?? 0,
          skillCoverage: confidenceReasons.skillCoverage ?? 0,
          recency: confidenceReasons.recency ?? 0,
        }
      : null;

    return {
      candidateId: m.candidateId,
      candidateName: m.candidate.fullName,
      candidateTitle: m.candidate.currentTitle,
      matchScore: m.matchScore,
      confidence: m.confidence,
      explanationSummary: explanation.summary ?? "(no explanation summary)",
      confidenceDetails,
<<<<<<< ours
      shortlisted: m.shortlisted,
=======
      confidenceReasons,
      shortlisted: Boolean((m as any).shortlisted),
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
