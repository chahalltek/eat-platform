import { notFound } from "next/navigation";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { FireDrillBanner } from "@/components/FireDrillBanner";
import { JobExecutionConsole, type JobConsoleCandidate, type JobConsoleProps } from "./JobExecutionConsole";
import { getAgentAvailability } from "@/lib/agents/agentAvailability";
import { getCurrentTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { categorizeConfidence } from "@/app/jobs/[jobId]/matches/confidence";

type MatchResultWithCandidate = Prisma.MatchResultGetPayload<{
  include: { candidate: true };
}>;

function toExplanationSummary(reasons: MatchResultWithCandidate["reasons"]): string {
  if (!reasons) return "Explanation not generated yet.";

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

  return "Explanation not generated yet.";
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

    return {
      candidateId: match.candidateId,
      candidateName: match.candidate?.fullName ?? "Unnamed candidate",
      score: match.score ?? null,
      confidenceScore: confidence.score,
      confidenceBand: confidence.band,
      shortlisted: Boolean(match.shortlisted),
      explanation: toExplanationSummary(match.reasons),
    } satisfies JobConsoleCandidate;
  });
}

export default async function JobConsolePage({ params }: { params: { jobId: string } }) {
  const job = await prisma.jobReq.findUnique({
    where: { id: params.jobId },
    include: {
      skills: true,
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
  const availability = await getAgentAvailability(tenantId);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50">
      {availability.mode.mode === "fire_drill" ? <FireDrillBanner /> : null}
      <ETEClientLayout maxWidthClassName="max-w-6xl" contentClassName="py-10">
        <JobExecutionConsole
          jobId={job.id}
          jobTitle={job.title}
          jobLocation={job.location}
          summary={job.rawDescription}
          mustHaveSkills={mustHaveSkills}
          initialCandidates={initialCandidates}
          agentState={agents}
          modeLabel={modeLabel}
          modeDescription={modeDescription}
        />
      </ETEClientLayout>
    </div>
  );
}
