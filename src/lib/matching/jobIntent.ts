import { JobIntent, JobReq, JobSkill } from "@/server/db";

export type JobIntentPayload = {
  title?: string | null;
  location?: string | null;
  seniorityLevel?: string | null;
  skills?: Array<{ name: string; normalizedName?: string | null; required?: boolean; weight?: number | null }>;
};

export class JobIntentMissingError extends Error {
  constructor(jobReqId: string) {
    super(`JobIntent missing for jobReq ${jobReqId}`);
    this.name = "JobIntentMissingError";
  }
}

function normalizeIntentSkills(jobIntent: JobIntent): JobSkill[] {
  const intent = (jobIntent.intent ?? {}) as JobIntentPayload;
  const skills = intent.skills ?? [];

  if (!skills.length) return [];

  return skills
    .map((skill, idx) => ({
      id: `${jobIntent.id}-skill-${idx}`,
      tenantId: jobIntent.tenantId,
      jobReqId: jobIntent.jobReqId,
      name: skill.name,
      normalizedName: skill.normalizedName ?? skill.name.trim().toLowerCase(),
      required: Boolean(skill.required),
      weight: typeof skill.weight === "number" ? skill.weight : skill.required ? 2 : 1,
    }))
    .filter((skill) => Boolean(skill.name?.trim()));
}

export function applyJobIntent(
  jobReq: JobReq & { skills: JobSkill[] },
  jobIntent: JobIntent | null,
): JobReq & { skills: JobSkill[] } {
  if (!jobIntent) {
    throw new JobIntentMissingError(jobReq.id);
  }

  const intentPayload = (jobIntent.intent ?? {}) as JobIntentPayload;
  const intentSkills = normalizeIntentSkills(jobIntent);

  const mergedSkills = intentSkills.length > 0 ? intentSkills : jobReq.skills;

  return {
    ...jobReq,
    title: intentPayload.title ?? jobReq.title,
    location: intentPayload.location ?? jobReq.location,
    seniorityLevel: intentPayload.seniorityLevel ?? jobReq.seniorityLevel,
    skills: mergedSkills,
  };
}
