import type { Metadata } from "next";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { getCurrentTenantId } from "@/lib/tenant";
import { prisma } from "@/server/db/prisma";
import { MatchesClient, type JobOption, type MatchListRow } from "./MatchesClient";
import { getCurrentUser } from "@/lib/auth/user";
import { canRunAgentMatch } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Match results",
};

function toJobOption(job: {
  id: string;
  title: string;
  location: string | null;
  customer: { name: string | null } | null;
}): JobOption {
  return {
    id: job.id,
    title: job.title,
    location: job.location,
    customer: job.customer?.name,
  };
}

function toMatchRow(match: {
  id: string;
  score: number | null;
  reasons: unknown;
  candidateId: string;
  candidate: {
    fullName: string | null;
    currentTitle: string | null;
  };
  candidateSignalBreakdown: unknown;
}): MatchListRow {
  const breakdown = (match.candidateSignalBreakdown as { confidence?: { score?: number; band?: string } } | null) ?? {};
  const confidence = breakdown.confidence ?? {};
  const reasons = match.reasons as { summary?: string } | string | null;
  const highlight =
    typeof reasons === "string"
      ? reasons
      : typeof reasons === "object" && reasons?.summary
        ? reasons.summary
        : null;

  return {
    id: match.id,
    candidateId: match.candidateId,
    candidateName: match.candidate.fullName ?? "Candidate",
    currentTitle: match.candidate.currentTitle,
    score: match.score,
    confidence: {
      score: typeof confidence.score === "number" ? confidence.score : null,
      band: typeof confidence.band === "string" ? confidence.band : null,
    },
    highlight,
  };
}

export default async function MatchesPage({ searchParams }: { searchParams?: { jobId?: string } }) {
  const tenantId = await getCurrentTenantId();
  const currentUser = await getCurrentUser();
  const hasAccess = currentUser ? canRunAgentMatch(currentUser, tenantId) : false;

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
            id: true,
            score: true,
            reasons: true,
            candidateId: true,
            candidate: { select: { fullName: true, currentTitle: true } },
            candidateSignalBreakdown: true,
          },
          orderBy: { score: "desc" },
          take: 25,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    .catch((error) => {
      console.error("Failed to load match jobs", error);
      return [];
    });

  const jobOptions = jobs.map(toJobOption);
  const requestedJobId = searchParams?.jobId;
  const selectedJob =
    jobs.find((job) => job.id === requestedJobId) ?? (jobOptions.length > 0 ? jobs[0] : null);

  const initialMatches: MatchListRow[] = selectedJob?.matchResults.map(toMatchRow) ?? [];

  return (
    <ETEClientLayout maxWidthClassName="max-w-6xl" contentClassName="space-y-6">
      <MatchesClient
        jobs={jobOptions}
        initialJobId={selectedJob?.id}
        initialMatches={initialMatches}
        rbacWarning={hasAccess ? undefined : "Sourcer, Recruiter, or Admin access is required to view match results."}
      />
    </ETEClientLayout>
  );
}
