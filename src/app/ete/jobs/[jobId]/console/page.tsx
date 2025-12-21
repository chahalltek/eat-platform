import { notFound, redirect } from "next/navigation";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { FireDrillBanner } from "@/components/FireDrillBanner";
import { JobExecutionConsole, type JobConsoleCandidate, type JobConsoleProps } from "./JobExecutionConsole";
import { getAgentAvailability } from "@/lib/agents/agentAvailability";
import { getCurrentTenantId } from "@/lib/tenant";
import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/server/db/prisma";
import { categorizeConfidence } from "@/app/jobs/[jobId]/matches/confidence";
import { getCurrentUser } from "@/lib/auth/user";
import { normalizeRole, USER_ROLES } from "@/lib/auth/roles";
import type { Explanation } from "@/lib/agents/explainEngine";
import { BackToConsoleButton } from "@/components/BackToConsoleButton";
import { extractTradeoffDefaultsFromScoring } from "@/lib/matching/tradeoffs";
import { loadTenantConfig } from "@/lib/guardrails/tenantConfig";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { FEATURE_FLAGS } from "@/lib/featureFlags/constants";
import { extractArchetypeFromIntent } from "@/lib/jobIntent";
import { getDecisionCultureCues } from "@/lib/judgmentMemory/culturalCues";
import { DecisionCultureCallouts } from "./DecisionCultureCallouts";
import { HARD_FEATURE_FLAGS, isHardFeatureEnabled } from "@/config/featureFlags";

type MatchResultWithCandidate = Prisma.MatchResultGetPayload<{
  include: { candidate: true };
}>;

function toExplanationSummary(reasons: MatchResultWithCandidate["reasons"]): string | null {
  if (!reasons) return null;

  if (typeof reasons === "string") return reasons;

  if (Array.isArray(reasons)) {
    const parts = reasons
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && "text" in entry) {
          return String((entry as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .filter(Boolean);

    if (parts.length > 0) return parts.join(" • ");
  }

  if (typeof reasons === "object") {
    const summary = (reasons as { summary?: unknown }).summary;
    if (typeof summary === "string" && summary.trim().length > 0) return summary;
  }

  return null;
}

function parseConfidenceBand(match: MatchResultWithCandidate): {
  score: number | null;
  band: JobConsoleCandidate["confidenceBand"];
} {
  const breakdown = match.candidateSignalBreakdown as
    | { confidence?: { score?: number; category?: string } }
    | null
    | undefined;
  const confidence = breakdown?.confidence;

  const score = typeof confidence?.score === "number" ? Math.round(confidence.score) : null;
  const category = confidence?.category;
  const normalizedCategory = typeof category === "string" ? category.toUpperCase() : null;

  if (normalizedCategory === "HIGH" || normalizedCategory === "MEDIUM" || normalizedCategory === "LOW") {
    return { score, band: normalizedCategory };
  }

  if (score !== null) {
    const derived = categorizeConfidence(score);
    if (derived) {
      return { score, band: derived.toUpperCase() as JobConsoleCandidate["confidenceBand"] };
    }
  }

  return { score, band: null };
}

function buildInitialCandidates(matches: MatchResultWithCandidate[]): JobConsoleCandidate[] {
  return matches.map((match) => {
    const confidence = parseConfidenceBand(match);
    const summary = toExplanationSummary(match.reasons);
    const strengths = Array.isArray((match.reasons as { strengths?: unknown } | null | undefined)?.strengths)
      ? ((match.reasons as { strengths?: unknown }).strengths as unknown[]).map((entry) => String(entry)).filter(Boolean)
      : [];
    const risks = Array.isArray((match.reasons as { risks?: unknown } | null | undefined)?.risks)
      ? ((match.reasons as { risks?: unknown }).risks as unknown[]).map((entry) => String(entry)).filter(Boolean)
      : [];
    const explanation: (Explanation & { summaryOnly?: boolean }) | null = summary
      ? { summary, strengths, risks, summaryOnly: strengths.length === 0 && risks.length === 0 }
      : strengths.length || risks.length
        ? { summary: "Explanation not generated yet.", strengths, risks, summaryOnly: strengths.length === 0 && risks.length === 0 }
        : null;

    return {
      candidateId: match.candidateId,
      candidateName: match.candidate?.fullName ?? "Unnamed candidate",
      score: match.score ?? null,
      confidenceScore: confidence.score,
      confidenceBand: confidence.band,
      shortlisted: Boolean(match.shortlisted),
      recommendedOutcome: match.shortlisted ? "shortlist" : "pass",
      explanation,
    } satisfies JobConsoleCandidate;
  });
}

export default async function JobConsolePage({ params }: { params: { jobId: string } }) {
  const currentUser = await getCurrentUser();
  const normalizedRole = normalizeRole(currentUser?.role);
  const recruiterRoles = new Set<string>([
    USER_ROLES.ADMIN,
    USER_ROLES.SYSTEM_ADMIN,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.RECRUITER,
    USER_ROLES.FULFILLMENT_RECRUITER,
    USER_ROLES.FULFILLMENT_MANAGER,
    USER_ROLES.FULFILLMENT_SOURCER,
    USER_ROLES.SOURCER,
    USER_ROLES.SALES,
  ]);

  if (!normalizedRole || !recruiterRoles.has(normalizedRole)) {
    redirect("/ete/jobs");
  }

  const job = await prisma.jobReq.findUnique({
    where: { id: params.jobId },
    include: {
      skills: true,
      jobIntent: true,
      matchResults: {
        include: { candidate: true },
        orderBy: { score: "desc" },
      },
    },
  });

  if (!job) {
    notFound();
  }

  const tenantId = await getCurrentTenantId();
  const guardrails = await loadTenantConfig(tenantId);
  const defaultTradeoffs = extractTradeoffDefaultsFromScoring(guardrails.scoring);
  const availability = await getAgentAvailability(tenantId);
  const showDecisionMomentCues = await isFeatureEnabled(FEATURE_FLAGS.DECISION_MOMENT_CUES);
  const showSopContextualLinks = await isFeatureEnabled(FEATURE_FLAGS.SOP_CONTEXTUAL_LINKS);
  const showCultureCues = await isFeatureEnabled(FEATURE_FLAGS.DECISION_CULTURE_CUES);
  const bullhornWritebackEnabled = isHardFeatureEnabled(HARD_FEATURE_FLAGS.REAL_ATS_WRITEBACK_ENABLED);
  const agents: JobConsoleProps["agentState"] = [
    { name: "MATCH", enabled: availability.isEnabled("MATCH") },
    { name: "CONFIDENCE", enabled: availability.isEnabled("CONFIDENCE") },
    { name: "EXPLAIN", enabled: availability.isEnabled("EXPLAIN") },
    { name: "SHORTLIST", enabled: availability.isEnabled("SHORTLIST") },
  ];

  const modeLabel = availability.mode.mode.replace("_", " ");
  const modeDescription = availability.mode.mode === "fire_drill"
    ? "Fire Drill pauses Explain and Confidence. Switch modes to re-enable."
    : undefined;

  const initialCandidates = buildInitialCandidates(job.matchResults);
  const mustHaveSkills = job.skills.filter((skill) => skill.required).map((skill) => skill.name);
  const archetype = extractArchetypeFromIntent(job.jobIntent?.intent);
  const cultureCues = showCultureCues
    ? await getDecisionCultureCues({ clientId: job.customerId, roleType: job.title })
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50">
      {availability.mode.mode === "fire_drill" ? <FireDrillBanner /> : null}
      <ETEClientLayout maxWidthClassName="max-w-6xl" contentClassName="py-10">
        <div className="mb-4 flex justify-end">
          <BackToConsoleButton />
        </div>
        {showCultureCues ? <DecisionCultureCallouts cues={cultureCues} /> : null}
        <JobExecutionConsole
          jobId={job.id}
          jobTitle={job.title}
          jobLocation={job.location}
          summary={job.rawDescription}
          userRole={normalizedRole}
          mustHaveSkills={mustHaveSkills}
          initialCandidates={initialCandidates}
          agentState={agents}
          modeLabel={modeLabel}
          modeDescription={modeDescription}
          defaultTradeoffs={defaultTradeoffs}
          showDecisionMomentCues={showDecisionMomentCues}
          archetype={archetype}
          showSopContextualLink={showSopContextualLinks}
          bullhornWritebackEnabled={bullhornWritebackEnabled}
        />
      </ETEClientLayout>
    </div>
  );
}
