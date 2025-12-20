import { notFound, redirect } from "next/navigation";

import { HiringManagerView } from "./HiringManagerView";
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/server/db/prisma";
import type { ShortlistCandidate, ShortlistRunMeta } from "./HiringManagerView";
import { getCurrentUser } from "@/lib/auth/user";
import { normalizeRole, USER_ROLES } from "@/lib/auth/roles";
import { BackToConsoleButton } from "@/components/BackToConsoleButton";
import { FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";

type MatchResultWithCandidate = Prisma.MatchResultGetPayload<{
  include: { candidate: { include: { skills: true } } };
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

function buildStrengths(match: MatchResultWithCandidate): string[] {
  const normalized = match.candidate.normalizedSkills ?? [];
  if (normalized.length > 0) return normalized.slice(0, 2);

  const skills = match.candidate.skills.map((skill) => skill.name).filter(Boolean);
  if (skills.length > 0) return skills.slice(0, 2);

  const summary = match.candidate.summary;
  if (summary) return [summary.slice(0, 140) + (summary.length > 140 ? "…" : "")];

  return ["Strengths not captured in run meta."];
}

function buildWeaknesses(match: MatchResultWithCandidate, requiredSkills: string[]): string[] {
  const candidateSkills = new Set((match.candidate.normalizedSkills ?? []).map((skill) => skill.toLowerCase()));
  const missingRequired = requiredSkills.filter((skill) => !candidateSkills.has(skill.toLowerCase()));

  const breakdown = match.candidateSignalBreakdown as
    | { risks?: string[]; warnings?: string[]; unknownFields?: string[] }
    | null
    | undefined;

  const risks = [
    ...(breakdown?.risks ?? []),
    ...(breakdown?.warnings ?? []),
    ...(breakdown?.unknownFields ?? []),
  ].filter(Boolean);

  const inferred = missingRequired.length > 0 ? missingRequired.map((skill) => `Missing must-have: ${skill}`) : [];
  const combined = [...risks, ...inferred];

  if (combined.length === 0) {
    return ["No notable risks captured in shortlist run meta."];
  }

  return combined.slice(0, 3);
}

type ConfidenceSnapshot = {
  band: "HIGH" | "MEDIUM" | "LOW" | null;
  score: number | null;
  reasons: string[];
};

function extractConfidence(
  breakdown: MatchResultWithCandidate["candidateSignalBreakdown"],
): ConfidenceSnapshot | null {
  if (!breakdown || typeof breakdown !== "object") return null;

  const confidence = (breakdown as { confidence?: unknown }).confidence as Record<string, unknown> | undefined;
  if (!confidence || typeof confidence !== "object") return null;

  const bandValue =
    typeof confidence.category === "string"
      ? confidence.category
      : typeof confidence.band === "string"
        ? confidence.band
        : null;
  const band = bandValue ? bandValue.toUpperCase() : null;
  const score = typeof confidence.score === "number" ? confidence.score : null;
  const reasons = Array.isArray(confidence.reasons)
    ? (confidence.reasons as unknown[])
        .filter((reason): reason is string => typeof reason === "string" && reason.trim().length > 0)
        .map((reason) => reason.trim())
    : [];

  if (!band && score === null && reasons.length === 0) return null;

  return { band: (band as ConfidenceSnapshot["band"]) ?? null, score, reasons };
}

function normalizeConfidenceReasons(reasons: string[]): string[] {
  const normalized = new Set<string>();

  reasons.forEach((reason) => {
    const trimmed = reason.trim().replace(/[.;\s]+$/g, "");
    if (!trimmed) return;

    const lower = trimmed.toLowerCase();
    if (lower.includes("confidence")) return;
    if (lower.includes("data completeness") || lower.includes("title") || lower.includes("location")) {
      normalized.add("complete and reliable profile data");
      return;
    }
    if (lower.includes("skill overlap") || lower.includes("skill coverage") || lower.includes("skills")) {
      normalized.add("strong alignment to the required skills");
      return;
    }
    if (lower.includes("recency") || lower.includes("updated")) {
      normalized.add("recently updated candidate information");
      return;
    }

    normalized.add(trimmed);
  });

  return Array.from(normalized).slice(0, 3);
}

function formatReasonsList(reasons: string[]): string {
  if (reasons.length === 1) return reasons[0];
  if (reasons.length === 2) return `${reasons[0]} and ${reasons[1]}`;

  return `${reasons[0]}, ${reasons[1]}, and ${reasons[2]}`;
}

function buildConfidenceStatement(
  confidence: ConfidenceSnapshot | null,
  enableSignal: boolean,
  reasons: string[],
): string | null {
  if (!enableSignal) return null;
  if (!confidence || confidence.band !== "HIGH") return null;

  const reasonsForStatement = reasons.length ? reasons : ["strong alignment to the role requirements"];

  return `This recommendation was made with high confidence based on ${formatReasonsList(reasonsForStatement)}.`;
}

function toShortlistCandidate(
  match: MatchResultWithCandidate,
  requiredSkills: string[],
  options: { enableConfidenceSignal: boolean },
): ShortlistCandidate {
  const confidence = extractConfidence(match.candidateSignalBreakdown);
  const confidenceReasons = normalizeConfidenceReasons(confidence?.reasons ?? []);
  const confidenceStatement = buildConfidenceStatement(confidence, options.enableConfidenceSignal, confidenceReasons);

  return {
    id: match.id,
    candidateId: match.candidateId,
    name: match.candidate.fullName ?? "Unnamed candidate",
    channel: match.candidate.sourceType ?? match.candidate.sourceTag ?? "Not provided",
    strengths: buildStrengths(match),
    weaknesses: buildWeaknesses(match, requiredSkills),
    explanation: toExplanationSummary(match.reasons),
    shortlisted: Boolean(match.shortlisted),
    shortlistReason: match.shortlistReason ?? null,
    role: match.candidate.currentTitle ?? match.candidate.currentCompany ?? null,
    location: match.candidate.location,
    email: match.candidate.email,
    matchScore: match.score ?? null,
    confidenceScore: confidence?.score ?? null,
    confidenceBand: confidence?.band ?? null,
    confidenceReasons,
    confidenceStatement,
  };
}

function normalizeShortlistRunMeta(runs: Prisma.AgentRunLogGetPayload<{}>[], jobId: string): ShortlistRunMeta | null {
  const shortlistRun = runs.find((run) => {
    const snapshot = run.inputSnapshot as { jobId?: string } | null;
    return snapshot?.jobId === jobId;
  });

  if (!shortlistRun) return null;

  const output = shortlistRun.outputSnapshot as
    | { shortlistedCandidates?: Array<{ candidateId: string }>; totalMatches?: number; strategy?: string }
    | null
    | undefined;

  return {
    runId: shortlistRun.id,
    startedAt: shortlistRun.startedAt.toISOString(),
    finishedAt: shortlistRun.finishedAt ? shortlistRun.finishedAt.toISOString() : null,
    shortlistedCount: output?.shortlistedCandidates?.length ?? 0,
    totalMatches: output?.totalMatches ?? 0,
    strategy: output?.strategy,
  };
}

export default async function HiringManagerPage({ params }: { params: { jobId: string } }) {
  const currentUser = await getCurrentUser();
  const normalizedRole = normalizeRole(currentUser?.role);
  const hiringManagerRoles = new Set<string>([
    USER_ROLES.ADMIN,
    USER_ROLES.SYSTEM_ADMIN,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.MANAGER,
  ]);

  if (!normalizedRole || !hiringManagerRoles.has(normalizedRole)) {
    redirect("/");
  }

  const [job, clientConfidenceSignalEnabled] = await Promise.all([
    prisma.jobReq.findUnique({
      where: { id: params.jobId },
      include: {
        customer: { select: { name: true } },
        skills: true,
        matchResults: {
          include: {
            candidate: { include: { skills: true } },
          },
          orderBy: { score: "desc" },
        },
      },
    }),
    isFeatureEnabled(FEATURE_FLAGS.CLIENT_CONFIDENCE_SIGNAL),
  ]);

  if (!job) {
    notFound();
  }

  const shortlistedRuns = await prisma.agentRunLog.findMany({
    where: { sourceTag: "shortlist" },
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  const requiredSkills = job.skills.filter((skill) => skill.required).map((skill) => skill.name);
  const shortlistMeta = normalizeShortlistRunMeta(shortlistedRuns, job.id);
  const shortlist = job.matchResults.map((match) =>
    toShortlistCandidate(match, requiredSkills, { enableConfidenceSignal: clientConfidenceSignalEnabled }),
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50">
      <ETEClientLayout maxWidthClassName="max-w-6xl" contentClassName="py-10">
        <div className="mb-4 flex justify-end">
          <BackToConsoleButton />
        </div>
        <HiringManagerView
          jobTitle={job.title}
          jobLocation={job.location}
          jobId={job.id}
          customerName={job.customer?.name ?? ""}
          summary={job.rawDescription}
          shortlist={shortlist}
          shortlistMeta={shortlistMeta}
          requiredSkills={requiredSkills}
        />
      </ETEClientLayout>
    </div>
  );
}
