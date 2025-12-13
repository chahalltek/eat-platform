import { assertAgentEnabled } from "@/lib/agents/availability";
import { AgentRetryMetadata, withAgentRun } from "@/lib/agents/agentRun";
import { getConfidenceBand } from "@/lib/agents/confidenceEngine";
import { buildShortlist, type ShortlistStrategy } from "@/lib/agents/shortlistEngine";
import { AGENT_KILL_SWITCHES } from "@/lib/agents/killSwitch";
import { getCurrentUser } from "@/lib/auth";
import { loadTenantConfig } from "@/lib/config/tenantConfig";
import { guardrailsPresets, type GuardrailsConfig } from "@/lib/guardrails/presets";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { prisma } from "@/lib/prisma";
import { setShortlistState } from "@/lib/matching/shortlist";
import { recordMetricEvent } from "@/lib/metrics/events";

export type RunShortlistInput = {
  jobId: string;
  recruiterId?: string;
  shortlistLimit?: number;
  candidateIds?: string[];
  tenantId?: string;
};

export type RunShortlistResult = {
  jobId: string;
  shortlistedCandidates: Array<{
    candidateId: string;
    score: number;
    confidenceBand: ReturnType<typeof getConfidenceBand>;
    shortlistReason: string;
  }>;
  totalMatches: number;
  cutoffScore?: number;
  strategy: ShortlistStrategy;
};

type ShortlistDependencies = {
  now?: () => Date;
};

export async function runShortlist(
  { jobId, recruiterId: _recruiterId, shortlistLimit, candidateIds, tenantId }: RunShortlistInput,
  _deps: ShortlistDependencies = {},
  guardrailOverrides?: GuardrailsConfig,
  retryMetadata?: AgentRetryMetadata,
): Promise<RunShortlistResult & { agentRunId: string }> {
  const user = await getCurrentUser();
  await assertAgentEnabled("shortlistEnabled", "Shortlist agent is disabled in Fire Drill mode");

  if (!user) {
    throw new Error("Current user is required to run shortlist agent");
  }

  // User identity is derived from auth; recruiterId in payload is ignored.
  const requestedShortlistLimit = shortlistLimit ?? null;

  const [result, agentRunId] = await withAgentRun<RunShortlistResult>(
    {
      agentName: AGENT_KILL_SWITCHES.RANKER,
      recruiterId: user.id,
      inputSnapshot: { jobId, shortlistLimit: requestedShortlistLimit },
      sourceType: "agent",
      sourceTag: "shortlist",
      ...retryMetadata,
    },
    async () => {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          matches: {
            include: {
              candidate: true,
            },
          },
        },
      });

      if (!job) {
        throw new Error(`Job ${jobId} not found for shortlist agent`);
      }

      const tenantConfig = guardrailOverrides ?? (await loadTenantConfig(tenantId ?? job.tenantId));
      const tenantMode = await loadTenantMode(job.tenantId);
      const isFireDrill = tenantMode.mode === "fire_drill";

      const conservativeThresholds = guardrailsPresets.conservative.scoring.thresholds as {
        minMatchScore?: number;
        shortlistMinScore?: number;
        shortlistMaxCandidates?: number;
      };

      const shortlistOverrides = (tenantConfig.shortlist as { strategy?: ShortlistStrategy; maxCandidates?: number } | undefined) ?? {};
      const thresholds = (tenantConfig.scoring as { thresholds?: { [key: string]: unknown } } | undefined)?.thresholds ?? {};

      const fireDrillThresholds = isFireDrill
        ? {
            ...thresholds,
            minMatchScore: Math.max(
              (thresholds.minMatchScore as number | undefined) ?? 0,
              conservativeThresholds.minMatchScore ?? 0,
            ),
            shortlistMinScore: Math.max(
              (thresholds.shortlistMinScore as number | undefined) ?? 0,
              conservativeThresholds.shortlistMinScore ?? 0,
            ),
            shortlistMaxCandidates: Math.min(
              (thresholds.shortlistMaxCandidates as number | undefined) ?? Number.POSITIVE_INFINITY,
              conservativeThresholds.shortlistMaxCandidates ?? Number.POSITIVE_INFINITY,
            ),
          }
        : thresholds;

      const guardrailSafety =
        (tenantConfig as GuardrailsConfig).safety ?? guardrailsPresets.balanced.safety;
      const shortlistMaxCandidates = fireDrillThresholds.shortlistMaxCandidates as number | undefined;

      const shortlistConfig: GuardrailsConfig = {
        scoring: { ...(tenantConfig.scoring as Record<string, unknown>), thresholds: fireDrillThresholds },
        explain: tenantConfig.explain,
        safety: guardrailSafety,
        shortlist: {
          strategy: isFireDrill ? "strict" : shortlistOverrides.strategy,
          maxCandidates: shortlistOverrides.maxCandidates ?? requestedShortlistLimit ?? shortlistMaxCandidates,
        },
      };

      if (job.matches.length === 0) {
        return {
          result: { jobId, shortlistedCandidates: [], totalMatches: 0, strategy: shortlistConfig.shortlist?.strategy ?? "quality" },
          outputSnapshot: { shortlistedCandidates: [] },
        };
      }

      const matches = job.matches
        .filter((match) => !candidateIds || candidateIds.includes(match.candidateId))
        .map((match) => {
          const score = Math.max(0, Math.min(100, Math.round(match.matchScore)));
          const matchSignals =
            ((match as { matchSignals?: Record<string, number> }).matchSignals ?? {}) as Record<string, number>;
          const signals = {
            mustHaveSkillsCoverage: matchSignals.mustHaveSkillsCoverage ?? 0,
            niceToHaveSkillsCoverage: matchSignals.niceToHaveSkillsCoverage ?? 0,
            experienceAlignment: matchSignals.experienceAlignment ?? 0,
            locationAlignment: matchSignals.locationAlignment ?? 0,
          };
          const confidenceBand = getConfidenceBand(match.confidence, shortlistConfig);

          return {
            candidateId: match.candidateId,
            score,
            confidenceBand,
            signals,
            rawMatch: match,
          };
        });

      const shortlistOutput = buildShortlist({ matches, config: shortlistConfig });
      const shortlistedCandidates = shortlistOutput.shortlistedCandidateIds
        .map((candidateId, index) => {
          const match = matches.find((entry) => entry.candidateId === candidateId);
          if (!match) return null;

          const shortlistReason = `#${index + 1} via ${shortlistConfig.shortlist?.strategy ?? "quality"} strategy (score ${match.score}, ${match.confidenceBand} confidence)`;

          return {
            candidateId,
            score: match.score,
            confidenceBand: match.confidenceBand,
            shortlistReason,
            rawMatch: match.rawMatch,
          };
        })
        .filter(Boolean) as Array<
        RunShortlistResult["shortlistedCandidates"][number] & { rawMatch: (typeof job.matches)[number] }>
        ;

      const cutoffScore =
        shortlistOutput.cutoffScore ??
        (shortlistedCandidates.length ? shortlistedCandidates[shortlistedCandidates.length - 1]?.score : undefined);
      const shortlistedByCandidate = new Map(shortlistedCandidates.map((entry) => [entry.candidateId, entry]));

      await prisma.$transaction(async (tx) => {
        for (const match of job.matches) {
          const shortlistEntry = shortlistedByCandidate.get(match.candidateId);
          await setShortlistState(job.id, match.candidateId, Boolean(shortlistEntry), shortlistEntry?.shortlistReason, {
            db: tx,
            tenantId: job.tenantId,
          });
        }
      });

      void recordMetricEvent({
        tenantId: job.tenantId,
        eventType: "SHORTLIST_CREATED",
        entityId: job.id,
        meta: {
          shortlistSize: shortlistedCandidates.length,
          totalMatches: matches.length,
          strategy: shortlistConfig.shortlist?.strategy ?? "quality",
          shortlistLimit: shortlistMaxCandidates ?? requestedShortlistLimit ?? null,
        },
      });

      return {
        result: {
          jobId,
          shortlistedCandidates: shortlistedCandidates.map(({ rawMatch: _raw, ...rest }) => rest),
          cutoffScore,
          totalMatches: matches.length,
          strategy: (shortlistConfig.shortlist?.strategy as ShortlistStrategy) ?? "quality",
        },
        outputSnapshot: {
          shortlistedCandidates: shortlistedCandidates.map(({ rawMatch: _raw, ...rest }) => rest),
        },
      };
    },
  );

  return { ...result, agentRunId };
}
