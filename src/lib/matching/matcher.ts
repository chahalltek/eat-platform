import { Candidate, CandidateSkill, JobReq, JobSkill } from "@prisma/client";

import { computeMatchScore } from "@/lib/matching/msa";
import { computeCandidateSignalScore } from "@/lib/matching/candidateSignals";
import { prisma } from "@/lib/prisma";
import { normalizeWeights } from "@/lib/matching/scoringConfig";
import { computeMatchConfidence } from "@/lib/matching/confidence";

type PrismaJobClient = Pick<typeof prisma, "jobReq">;
type PrismaMatchClient = Pick<typeof prisma, "matchResult">;

export type RawJobSkillInput = {
  name: string;
  required?: boolean;
  weight?: number;
};

export type JobIngestionInput = {
  title: string;
  location?: string | null;
  seniorityLevel?: string | null;
  rawDescription?: string | null;
  sourceType?: string | null;
  sourceTag?: string | null;
  skills?: RawJobSkillInput[];
};

export const normalizeSkillName = (name: string): string => name.trim().toLowerCase();

export function normalizeJobSkills(
  skills: RawJobSkillInput[] = [],
): Omit<JobSkill, "id" | "jobReqId" | "tenantId">[] {
  const uniqueSkills = new Map<string, Omit<JobSkill, "id" | "jobReqId" | "tenantId">>();

  skills.forEach((skill) => {
    const normalizedName = normalizeSkillName(skill.name);

    if (!normalizedName) return;

    const required = Boolean(skill.required);
    const weight = skill.weight && skill.weight > 0 ? skill.weight : required ? 2 : 1;

    if (!uniqueSkills.has(normalizedName)) {
      uniqueSkills.set(normalizedName, {
        name: skill.name.trim(),
        normalizedName,
        required,
        weight,
      });
    }
  });

  return Array.from(uniqueSkills.values());
}

export async function ingestJob(
  job: JobIngestionInput,
  client: PrismaJobClient = prisma,
): Promise<JobReq & { skills: JobSkill[] }> {
  const normalizedSkills = normalizeJobSkills(job.skills);

  const created = await client.jobReq.create({
    data: {
      title: job.title,
      location: job.location ?? null,
      seniorityLevel: job.seniorityLevel ?? null,
      rawDescription: job.rawDescription ?? "",
      sourceType: job.sourceType ?? null,
      sourceTag: job.sourceTag ?? null,
      skills: { create: normalizedSkills },
    },
    include: { skills: true },
  });

  if (Array.isArray((created as any).skills?.create)) {
    return { ...created, skills: (created as any).skills.create };
  }

  return created as JobReq & { skills: JobSkill[] };
}

export type MatchCandidateInput = {
  candidate: Candidate & { skills: CandidateSkill[] };
  jobReq: JobReq & { skills: JobSkill[] };
  outreachInteractions?: number;
  prismaClient?: PrismaMatchClient;
};

export async function matchCandidateToJob({
  candidate,
  jobReq,
  outreachInteractions = 0,
  prismaClient = prisma,
}: MatchCandidateInput) {
  const jobCandidate = null; // this helper is stateless and does not fetch jobCandidate records

  const candidateSignals = computeCandidateSignalScore({
    candidate,
    jobCandidate,
    outreachInteractions,
  });

  const matchScore = computeMatchScore(
    { candidate, jobReq },
    { candidateSignals },
  );

  const confidence = computeMatchConfidence({ candidate, jobReq });

  const candidateSignalBreakdown = {
    ...(matchScore.candidateSignalBreakdown ?? {}),
    confidence,
  } as const;

  const savedMatch = await prismaClient.matchResult.create({
    data: {
      candidateId: candidate.id,
      jobReqId: jobReq.id,
      score: matchScore.score,
      reasons: matchScore.explanation,
      skillScore: matchScore.skillScore,
      seniorityScore: matchScore.seniorityScore,
      locationScore: matchScore.locationScore,
      candidateSignalScore: matchScore.candidateSignalScore,
      candidateSignalBreakdown,
    },
  });

  return { matchScore, matchResult: savedMatch, confidence };
}

export function normalizeWeightConfig(weights: Record<string, number>) {
  return normalizeWeights(weights);
}

