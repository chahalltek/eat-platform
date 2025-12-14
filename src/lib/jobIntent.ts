import { JobIntent, JobReq, JobSkill, PrismaClient } from '@prisma/client';

import type { JobIntentPayload, JobIntentRequirement } from '@/types/jobIntent';

const DEFAULT_WEIGHT = 1;
const REQUIRED_WEIGHT = 2;
const DEFAULT_CONFIDENCE = 0.9;

type JobIntentPrismaClient = Pick<PrismaClient, 'jobIntent'>;

type MinimalSkillInput = {
  name: string;
  normalizedName?: string | null;
  required?: boolean;
  weight?: number | null;
};

type JobIntentBuildInput = {
  title?: string | null;
  location?: string | null;
  employmentType?: string | null;
  seniorityLevel?: string | null;
  skills?: MinimalSkillInput[];
  sourceDescription?: string | null;
  confidenceLevels?: Record<string, number>;
  createdFrom?: string;
};

function normalizeLabel(value?: string | null) {
  return value?.trim().toLowerCase() ?? null;
}

export function buildSkillRequirements(
  skills: MinimalSkillInput[] = [],
  confidence = DEFAULT_CONFIDENCE,
): JobIntentRequirement[] {
  return skills
    .filter((skill) => Boolean(skill?.name?.trim()))
    .map((skill) => {
      const weight = skill.weight ?? (skill.required ? REQUIRED_WEIGHT : DEFAULT_WEIGHT);
      const normalizedLabel = skill.normalizedName || skill.name;

      return {
        id: normalizeLabel(normalizedLabel) || skill.name.trim(),
        type: 'skill' as const,
        label: skill.name.trim(),
        normalizedLabel: normalizeLabel(normalizedLabel),
        required: Boolean(skill.required),
        weight,
        confidence,
      } satisfies JobIntentRequirement;
    });
}

export function buildJobIntentPayload(input: JobIntentBuildInput): JobIntentPayload {
  const requirements: JobIntentRequirement[] = [];
  const confidence = input.confidenceLevels?.requirements ?? DEFAULT_CONFIDENCE;

  requirements.push(...buildSkillRequirements(input.skills ?? [], confidence));

  if (input.location) {
    requirements.push({
      id: 'location',
      type: 'location',
      label: input.location,
      normalizedLabel: normalizeLabel(input.location),
      weight: DEFAULT_WEIGHT,
      confidence: input.confidenceLevels?.location ?? DEFAULT_CONFIDENCE,
    });
  }

  if (input.seniorityLevel) {
    requirements.push({
      id: 'seniority',
      type: 'seniority',
      label: input.seniorityLevel,
      normalizedLabel: normalizeLabel(input.seniorityLevel),
      weight: DEFAULT_WEIGHT,
      confidence: input.confidenceLevels?.seniority ?? DEFAULT_CONFIDENCE,
    });
  }

  if (input.employmentType) {
    requirements.push({
      id: 'employmentType',
      type: 'employmentType',
      label: input.employmentType,
      normalizedLabel: normalizeLabel(input.employmentType),
      weight: DEFAULT_WEIGHT,
      confidence: input.confidenceLevels?.employmentType ?? DEFAULT_CONFIDENCE,
    });
  }

  if (input.title) {
    requirements.push({
      id: 'summary',
      type: 'summary',
      label: input.title,
      normalizedLabel: normalizeLabel(input.title),
      weight: DEFAULT_WEIGHT,
      confidence: input.confidenceLevels?.title ?? DEFAULT_CONFIDENCE,
    });
  }

  return {
    summary: input.title ?? null,
    requirements,
    weightings: {
      skills: requirements.filter((req) => req.type === 'skill').length,
    },
    confidenceLevels: {
      requirements: confidence,
      ...input.confidenceLevels,
    },
    metadata: {
      sourceDescription: input.sourceDescription ?? null,
      createdFrom: input.createdFrom ?? 'intake',
    },
  } satisfies JobIntentPayload;
}

export function parseJobIntentPayload(intent: unknown): JobIntentPayload | null {
  if (!intent || typeof intent !== 'object') {
    return null;
  }

  const payload = intent as Partial<JobIntentPayload>;
  if (!Array.isArray(payload.requirements)) {
    return null;
  }

  return {
    summary: payload.summary ?? null,
    requirements: payload.requirements.filter((req): req is JobIntentRequirement => {
      return Boolean(req && typeof req === 'object' && typeof (req as JobIntentRequirement).label === 'string');
    }),
    weightings: payload.weightings ?? {},
    confidenceLevels: payload.confidenceLevels ?? {},
    metadata: payload.metadata ?? {},
  } satisfies JobIntentPayload;
}

export function applyJobIntent(
  jobReq: (JobReq & { skills: JobSkill[] }) & { jobIntent?: JobIntent | null },
): JobReq & { skills: JobSkill[] } {
  const payload = parseJobIntentPayload(jobReq.jobIntent?.intent);

  if (!payload) {
    return jobReq;
  }

  const skillRequirements = payload.requirements.filter((req) => req.type === 'skill');

  if (skillRequirements.length === 0) {
    return jobReq;
  }

  const intentSkills: JobSkill[] = skillRequirements.map((req, index) => ({
    id: `${jobReq.id}-intent-${index}`,
    jobReqId: jobReq.id,
    tenantId: jobReq.tenantId,
    name: req.label,
    normalizedName: normalizeLabel(req.normalizedLabel ?? req.label) ?? req.label.toLowerCase(),
    required: Boolean(req.required),
    weight: req.weight ?? (req.required ? REQUIRED_WEIGHT : DEFAULT_WEIGHT),
  }));

  return { ...jobReq, skills: intentSkills };
}

export async function upsertJobIntent(
  prismaClient: JobIntentPrismaClient,
  input: { jobReqId: string; tenantId: string; payload: JobIntentPayload; createdById?: string | null },
) {
  const { jobReqId, payload, tenantId, createdById } = input;

  return prismaClient.jobIntent.upsert({
    where: { jobReqId },
    update: { intent: payload, tenantId },
    create: { jobReqId, tenantId, intent: payload, createdById: createdById ?? null },
  });
}
