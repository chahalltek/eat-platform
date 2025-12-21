import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import {
  DecisionStatus,
  JobCandidateStatus,
  prisma,
  type Decision,
} from "@/server/db/prisma";

export type DecisionPayload = {
  job: {
    id: string;
    title: string;
    location: string | null;
    summary: string | null;
    intentSummary: string | null;
  };
  shortlist: Array<{
    candidateId: string;
    name: string | null;
    matchScore: number | null;
    confidenceBand: string | null;
    status: string;
    summary: string | null;
  }>;
  agentOutputs: {
    shortlistDigest: string[];
    intentSummary: string | null;
  };
  rationale: {
    decision: string;
    risks: string[];
    nextSteps: string;
  };
};

export type DecisionRecord = Decision & { payload: DecisionPayload; jobReqId: string; tenantId: string };

export type DecisionDto = Omit<DecisionRecord, "createdAt" | "updatedAt" | "publishedAt"> & {
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  jobId: string;
};

function summarizeIntent(intent: unknown): string | null {
  if (!intent) {
    return null;
  }

  if (typeof intent === "string") {
    const trimmed = intent.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof intent === "object") {
    const summary = (intent as { summary?: unknown }).summary;
    if (typeof summary === "string" && summary.trim()) {
      return summary.trim();
    }
  }

  try {
    const serialized = JSON.stringify(intent);
    if (!serialized) return null;

    return serialized.length > 400 ? `${serialized.slice(0, 397)}...` : serialized;
  } catch {
    return null;
  }
}

async function loadJobForDecision(jobId: string) {
  return prisma.jobReq.findUnique({
    where: { id: jobId },
    include: {
      jobIntent: { select: { intent: true } },
      jobCandidates: {
        where: { status: JobCandidateStatus.SHORTLISTED },
        include: {
          candidate: {
            select: {
              id: true,
              fullName: true,
              summary: true,
              currentTitle: true,
              currentCompany: true,
            },
          },
          lastMatch: { select: { score: true, reasons: true } },
        },
      },
    },
  });
}

type DecisionJob = NonNullable<Awaited<ReturnType<typeof loadJobForDecision>>>;

function buildShortlistDigest(candidate: {
  name: string | null;
  matchScore: number | null;
  confidenceBand: string | null;
  summary: string | null;
}) {
  const parts = [
    candidate.name ?? "Unnamed candidate",
    candidate.matchScore != null ? `score ${candidate.matchScore}` : null,
    candidate.confidenceBand ? `confidence ${candidate.confidenceBand.toLowerCase()}` : null,
    candidate.summary ? `note: ${candidate.summary}` : null,
  ].filter(Boolean);

  return parts.join(" — ");
}

function inferMatchScore(candidate: { lastMatch?: { score: number | null } | null }) {
  if (!candidate.lastMatch || candidate.lastMatch.score == null) return null;
  const rounded = Math.round(candidate.lastMatch.score);
  return Number.isFinite(rounded) ? rounded : null;
}

function describeCandidateSummary(candidate: DecisionJob["jobCandidates"][number]) {
  const headlineParts = [candidate.candidate.currentTitle, candidate.candidate.currentCompany].filter(Boolean);
  const headline = headlineParts.length ? headlineParts.join(" @ ") : null;
  return headline ?? candidate.candidate.summary ?? null;
}

function buildDecisionPayload(job: DecisionJob) {
  const shortlist = job.jobCandidates.map((candidate) => {
    const matchScore = inferMatchScore(candidate);

    return {
      candidateId: candidate.candidateId,
      name: candidate.candidate.fullName,
      matchScore,
      confidenceBand: candidate.confidenceBand ?? null,
      status: candidate.status,
      summary: describeCandidateSummary(candidate),
    };
  });

  const shortlistDigest = shortlist.map((candidate) => buildShortlistDigest(candidate));

  return {
    candidateIds: shortlist.map((candidate) => candidate.candidateId),
    payload: {
      job: {
        id: job.id,
        title: job.title,
        location: job.location,
        summary: job.rawDescription,
        intentSummary: summarizeIntent(job.jobIntent?.intent ?? null),
      },
      shortlist,
      agentOutputs: {
        shortlistDigest,
        intentSummary: summarizeIntent(job.jobIntent?.intent ?? null),
      },
      rationale: {
        decision: "",
        risks: [],
        nextSteps: "",
      },
    } satisfies DecisionPayload,
  };
}

export async function createDecisionDraft(input: { jobId: string; userId: string }): Promise<DecisionRecord> {
  const job = await loadJobForDecision(input.jobId);

  if (!job) {
    throw new Error("Job not found");
  }

  const { candidateIds, payload } = buildDecisionPayload(job);

  return prisma.decision.create({
    data: {
      jobReqId: job.id,
      tenantId: job.tenantId ?? DEFAULT_TENANT_ID,
      candidateIds,
      payload,
      status: DecisionStatus.DRAFT,
      createdBy: input.userId,
    },
  }) as unknown as Promise<DecisionRecord>;
}

export async function listDecisionsForJob(jobId: string): Promise<DecisionRecord[]> {
  return prisma.decision.findMany({
    where: { jobReqId: jobId },
    orderBy: { createdAt: "desc" },
  }) as unknown as Promise<DecisionRecord[]>;
}

export async function getDecisionById(decisionId: string): Promise<DecisionRecord | null> {
  return prisma.decision.findUnique({ where: { id: decisionId } }) as unknown as Promise<DecisionRecord | null>;
}

export async function publishDecisionDraft(decisionId: string, userId: string): Promise<DecisionRecord | null> {
  const decision = await getDecisionById(decisionId);

  if (!decision) {
    return null;
  }

  if (decision.status === DecisionStatus.PUBLISHED && decision.publishedAt) {
    return decision;
  }

  return prisma.decision.update({
    where: { id: decisionId },
    data: {
      status: DecisionStatus.PUBLISHED,
      publishedAt: new Date(),
      publishedBy: userId,
    },
  }) as unknown as Promise<DecisionRecord>;
}

export function toDecisionDto(decision: DecisionRecord): DecisionDto {
  return {
    ...decision,
    jobId: decision.jobReqId,
    createdAt: decision.createdAt instanceof Date ? decision.createdAt.toISOString() : new Date(decision.createdAt).toISOString(),
    updatedAt: decision.updatedAt instanceof Date ? decision.updatedAt.toISOString() : new Date(decision.updatedAt).toISOString(),
    publishedAt:
      decision.publishedAt instanceof Date
        ? decision.publishedAt.toISOString()
        : decision.publishedAt
          ? new Date(decision.publishedAt).toISOString()
          : null,
  };
}
