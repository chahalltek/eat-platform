import type { Metadata } from "next";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { canRunAgentExplain } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { prisma } from "@/server/db/prisma";
import { ExplainClient, type ExplainJobOption } from "./ExplainClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explain",
};

function toJobOption(job: {
  id: string;
  title: string;
  location: string | null;
  customer: { name: string | null } | null;
  matchResults: Array<{
    candidateId: string;
    candidate: { fullName: string | null };
  }>;
}): ExplainJobOption {
  return {
    id: job.id,
    title: job.title,
    location: job.location,
    customer: job.customer?.name,
    candidates: job.matchResults.map((match) => ({
      id: match.candidateId,
      name: match.candidate.fullName ?? match.candidateId,
    })),
  };
}

export default async function ExplainPage({ searchParams }: { searchParams?: { jobId?: string; candidateId?: string } }) {
  const tenantId = await getCurrentTenantId();
  const user = await getCurrentUser();
  const hasAccess = user ? canRunAgentExplain(user, tenantId) : false;

  const jobs = await prisma.jobReq
    .findMany({
      where: { tenantId },
      select: {
        id: true,
        title: true,
        location: true,
        customer: { select: { name: true } },
        matchResults: {
          select: {
            candidateId: true,
            candidate: { select: { fullName: true } },
          },
          orderBy: { score: "desc" },
          take: 25,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    })
    .catch((error) => {
      console.error("Failed to load explain jobs", error);
      return [];
    });

  const jobOptions = jobs.map(toJobOption);
  const requestedJobId = searchParams?.jobId;
  const selectedJob =
    jobs.find((job) => job.id === requestedJobId) ?? (jobOptions.length > 0 ? jobs[0] : null);
  const selectedCandidateId =
    searchParams?.candidateId && selectedJob?.matchResults.some((match) => match.candidateId === searchParams?.candidateId)
      ? searchParams.candidateId
      : selectedJob?.matchResults[0]?.candidateId ?? null;

  return (
    <ETEClientLayout maxWidthClassName="max-w-5xl" contentClassName="space-y-6">
      <ExplainClient
        jobs={jobOptions}
        initialJobId={selectedJob?.id}
        initialCandidateId={selectedCandidateId}
        initialResults={[]}
        rbacWarning={hasAccess ? undefined : "Sourcer, Recruiter, or Admin access is required to run Explain."}
      />
    </ETEClientLayout>
  );
}
