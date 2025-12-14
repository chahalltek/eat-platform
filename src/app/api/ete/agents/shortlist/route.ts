import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildShortlist } from "@/lib/agents/shortlistEngine";
import { getConfidenceBand } from "@/lib/agents/confidenceEngine";
import { AGENT_KILL_SWITCHES, enforceAgentKillSwitch } from "@/lib/agents/killSwitch";
import { getAgentAvailability } from "@/lib/agents/agentAvailability";
import { guardrailsPresets, type ShortlistStrategy } from "@/lib/guardrails/presets";
import { loadTenantConfig } from "@/lib/guardrails/tenantConfig";
import { prisma } from "@/server/db";
import { requireRole } from "@/lib/auth/requireRole";
import { USER_ROLES } from "@/lib/auth/roles";

const requestSchema = z.object({
  jobId: z.string().trim().min(1, "jobId is required"),
  candidateIds: z.array(z.string().trim().min(1)).optional(),
});

type ShortlistResponse = {
  jobId: string;
  strategy: ShortlistStrategy;
  shortlistedCandidateIds: string[];
  cutoffScore: number | null;
  notes: string[];
};

function normalizeThresholds(
  source?: { minMatchScore?: number; shortlistMinScore?: number; shortlistMaxCandidates?: number },
) {
  const normalizeScoreThreshold = (value?: number) =>
    typeof value === "number" ? (value <= 1 ? value * 100 : value) : undefined;

  const minMatchScore = normalizeScoreThreshold(source?.minMatchScore);
  const shortlistMinScore = normalizeScoreThreshold(source?.shortlistMinScore);
  const shortlistMaxCandidates = typeof source?.shortlistMaxCandidates === "number" ? source.shortlistMaxCandidates : undefined;

  return { minMatchScore, shortlistMinScore, shortlistMaxCandidates };
}

function applyFireDrillThresholds(
  base: ReturnType<typeof normalizeThresholds>,
  conservative: ReturnType<typeof normalizeThresholds>,
) {
  return {
    minMatchScore: Math.max(base.minMatchScore ?? 0, conservative.minMatchScore ?? 0),
    shortlistMinScore: Math.max(base.shortlistMinScore ?? 0, conservative.shortlistMinScore ?? 0),
    shortlistMaxCandidates: Math.min(
      base.shortlistMaxCandidates ?? Number.POSITIVE_INFINITY,
      conservative.shortlistMaxCandidates ?? Number.POSITIVE_INFINITY,
    ),
  } satisfies ReturnType<typeof normalizeThresholds>;
}

export async function POST(req: NextRequest) {
  const roleCheck = await requireRole(req, [USER_ROLES.ADMIN, USER_ROLES.RECRUITER]);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(rawBody);

  if (!parsed.success) {
    const errorMessage = parsed.error.issues.map((issue) => issue.message).join("; ") || "Invalid payload";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  const { jobId, candidateIds } = parsed.data;

  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { matches: true } });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const availability = await getAgentAvailability(job.tenantId);
  const killSwitchResponse = await enforceAgentKillSwitch(AGENT_KILL_SWITCHES.RANKER, job.tenantId);

  if (killSwitchResponse) {
    return killSwitchResponse;
  }

  if (!availability.isEnabled("SHORTLIST")) {
    return NextResponse.json({ error: "SHORTLIST disabled" }, { status: 503 });
  }

  const guardrails = await loadTenantConfig(job.tenantId);
  const conservativeThresholds = normalizeThresholds(
    (guardrailsPresets.conservative.scoring as { thresholds?: Record<string, number> })?.thresholds ?? {},
  );
  const baseThresholds = normalizeThresholds(
    (guardrails.scoring as { thresholds?: Record<string, number> } | undefined)?.thresholds ?? {},
  );

  const thresholds = availability.mode.mode === "fire_drill"
    ? applyFireDrillThresholds(baseThresholds, conservativeThresholds)
    : baseThresholds;

  const shortlistMaxCandidates = thresholds.shortlistMaxCandidates ??
    (guardrails.shortlist as { maxCandidates?: number } | undefined)?.maxCandidates ??
    Number.POSITIVE_INFINITY;

  const shortlistStrategy: ShortlistStrategy = availability.mode.mode === "fire_drill"
    ? "strict"
    : ((guardrails.shortlist as { strategy?: ShortlistStrategy } | undefined)?.strategy ?? "quality");

  const confidenceEnabled = availability.isEnabled("CONFIDENCE");
  const notes: string[] = [];
  let confidenceMissingNoted = false;
  const minimumScore = thresholds.shortlistMinScore ?? thresholds.minMatchScore ?? -Infinity;

  const matches = job.matches
    .filter((match) => !candidateIds || candidateIds.includes(match.candidateId))
    .filter((match) => Math.max(0, Math.min(100, match.matchScore)) >= minimumScore)
    .map((match) => {
      const score = Math.max(0, Math.min(100, match.matchScore));
      const confidenceScore =
        confidenceEnabled && typeof match.confidence === "number"
          ? match.confidence
          : null;

      if (!confidenceEnabled || confidenceScore === null) {
        confidenceMissingNoted = true;
      }

      const confidenceBand = getConfidenceBand(confidenceScore ?? score, guardrails);

      return {
        candidateId: match.candidateId,
        score,
        confidenceBand,
      };
    });

  const shortlistConfig = {
    ...guardrails,
    scoring: {
      ...(guardrails.scoring as Record<string, unknown>),
      thresholds,
    },
    shortlist: {
      ...(guardrails.shortlist as Record<string, unknown>),
      strategy: shortlistStrategy,
      maxCandidates: shortlistMaxCandidates,
    },
  } satisfies Parameters<typeof buildShortlist>[0]["config"];

  const shortlistOutput = buildShortlist({ matches, config: shortlistConfig, strategy: shortlistStrategy });
  const shortlistedCandidateIds = shortlistOutput.shortlistedCandidateIds;

  const scoredShortlisted = shortlistedCandidateIds
    .map((candidateId) => matches.find((match) => match.candidateId === candidateId))
    .filter((match): match is NonNullable<typeof match> => Boolean(match));

  const cutoffScore =
    shortlistOutput.cutoffScore ??
    (scoredShortlisted.length ? scoredShortlisted[scoredShortlisted.length - 1]?.score ?? null : null);

  if (shortlistOutput.notes?.length) {
    notes.push(...shortlistOutput.notes.filter((note) => !note.startsWith("strategy=") && !note.startsWith("minScore=")));
  }

  if (confidenceMissingNoted) {
    notes.push("Confidence unavailable; using match score only.");
  }

  if (availability.mode.mode === "fire_drill") {
    notes.push("Fire Drill mode active: using strict shortlist strategy and conservative thresholds.");
  }

  const response: ShortlistResponse = {
    jobId,
    strategy: shortlistStrategy,
    shortlistedCandidateIds,
    cutoffScore,
    notes,
  };

  return NextResponse.json(response, { status: 200 });
}
