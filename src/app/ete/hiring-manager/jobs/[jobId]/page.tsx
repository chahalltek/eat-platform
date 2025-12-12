import { notFound, redirect } from "next/navigation";

import { HiringManagerView } from "./HiringManagerView";
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { ShortlistCandidate, ShortlistRunMeta } from "./HiringManagerView";
import { getCurrentUser } from "@/lib/auth/user";
import { normalizeRole, USER_ROLES } from "@/lib/auth/roles";

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

function toShortlistCandidate(match: MatchResultWithCandidate, requiredSkills: string[]): ShortlistCandidate {
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
    score: match.score ?? null,
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
  const hiringManagerRoles = new Set<string>([USER_ROLES.ADMIN, USER_ROLES.SYSTEM_ADMIN, USER_ROLES.MANAGER]);

  if (!normalizedRole || !hiringManagerRoles.has(normalizedRole)) {
    redirect("/");
  }

  const job = await prisma.jobReq.findUnique({
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
  });

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
  const shortlist = job.matchResults.map((match) => toShortlistCandidate(match, requiredSkills));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50">
      <ETEClientLayout maxWidthClassName="max-w-6xl" contentClassName="py-10">
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
