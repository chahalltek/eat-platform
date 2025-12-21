import type { Metadata } from "next";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { canRunAgentShortlist } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { prisma } from "@/server/db/prisma";
import { ShortlistClient, type ShortlistJobOption } from "./ShortlistClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shortlist",
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
}): ShortlistJobOption {
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

export default async function ShortlistPage({ searchParams }: { searchParams?: { jobId?: string } }) {
  const tenantId = await getCurrentTenantId();
  const user = await getCurrentUser();
  const hasAccess = user ? canRunAgentShortlist(user, tenantId) : false;

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
          take: 50,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    })
    .catch((error) => {
      console.error("Failed to load shortlist jobs", error);
      return [];
    });

  const jobOptions = jobs.map(toJobOption);
  const requestedJobId = searchParams?.jobId;
  const selectedJob =
    jobs.find((job) => job.id === requestedJobId) ?? (jobOptions.length > 0 ? jobs[0] : null);

  return (
    <ETEClientLayout maxWidthClassName="max-w-5xl" contentClassName="space-y-6">
      <ShortlistClient
        jobs={jobOptions}
        initialJobId={selectedJob?.id}
        initialResults={[]}
        rbacWarning={hasAccess ? undefined : "Sourcer, Recruiter, or Admin access is required to run Shortlist."}
      />
    </ETEClientLayout>
  );
}
