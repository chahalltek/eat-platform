import { prisma } from "@/server/db/prisma";

const WINDOW_DAYS = 30;

export type DecisionQualityEntry = {
  id: string;
  jobId: string;
  jobTitle: string;
  clientName: string;
  team: string;
  feedback: string | null;
  outcome: string | null;
  confidenceScore: number | null;
  reviewerRole: string;
  reviewerName: string;
  createdAt: Date;
};

export type DecisionQualityFilters = {
  teams: string[];
  clients: string[];
  requisitions: { id: string; title: string }[];
};

export type DecisionQualitySignals = {
  windowDays: number;
  entries: DecisionQualityEntry[];
  filters: DecisionQualityFilters;
};

function normalizeTeam(sourceTag?: string | null, sourceType?: string | null) {
  if (sourceTag?.trim()) return sourceTag.trim();
  if (sourceType?.trim()) return sourceType.trim();
  return "Unassigned";
}

function clampConfidence(score: number | null | undefined) {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return null;
  }

  return Math.min(Math.max(score, 0), 100);
}

export async function getDecisionQualitySignals(tenantId: string): Promise<DecisionQualitySignals> {
  const sinceDate = new Date();
  sinceDate.setHours(0, 0, 0, 0);
  sinceDate.setDate(sinceDate.getDate() - (WINDOW_DAYS - 1));

  const feedbackEntries = await prisma.matchFeedback.findMany({
    where: { tenantId, createdAt: { gte: sinceDate } },
    select: {
      id: true,
      feedback: true,
      outcome: true,
      confidenceScore: true,
      createdAt: true,
      matchResult: {
        select: {
          jobReq: {
            select: {
              id: true,
              title: true,
              sourceTag: true,
              sourceType: true,
              customer: { select: { name: true } },
            },
          },
        },
      },
      user: { select: { displayName: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const entries = feedbackEntries.map<DecisionQualityEntry>((entry) => {
    const job = entry.matchResult?.jobReq;
    const clientName = job?.customer?.name?.trim() || "Unspecified client";
    const jobTitle = job?.title?.trim() || "Unlabeled requisition";

    return {
      id: entry.id,
      jobId: job?.id ?? "unknown",
      jobTitle,
      clientName,
      team: normalizeTeam(job?.sourceTag, job?.sourceType),
      feedback: entry.feedback,
      outcome: entry.outcome,
      confidenceScore: clampConfidence(entry.confidenceScore),
      reviewerRole: entry.user?.role ?? "Unknown",
      reviewerName: entry.user?.displayName ?? "Unknown reviewer",
      createdAt: entry.createdAt,
    };
  });

  const filters: DecisionQualityFilters = {
    teams: Array.from(new Set(entries.map((entry) => entry.team))).sort(),
    clients: Array.from(new Set(entries.map((entry) => entry.clientName))).sort(),
    requisitions: Array.from(
      new Map(entries.map((entry) => [entry.jobId, entry.jobTitle])).entries(),
    )
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };

  return {
    windowDays: WINDOW_DAYS,
    entries,
    filters,
  };
}
