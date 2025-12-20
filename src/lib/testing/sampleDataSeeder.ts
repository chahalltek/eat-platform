import { JobCandidateStatus } from "@/server/db/prisma";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { prisma } from "@/server/db/prisma";

type SampleSkill = {
  name: string;
  normalizedName: string;
  required?: boolean;
  weight?: number;
  proficiency?: string;
  yearsOfExperience?: number;
};

type SampleCandidate = {
  id: string;
  fullName: string;
  location: string;
  currentTitle: string;
  totalExperienceYears: number;
  seniorityLevel: string;
  summary: string;
  normalizedSkills: string[];
  skills: SampleSkill[];
};

type SampleJob = {
  id: string;
  title: string;
  location: string;
  employmentType: string;
  seniorityLevel: string;
  rawDescription: string;
  status: string;
  skills: SampleSkill[];
};

const SAMPLE_JOB: SampleJob = {
  id: "eat-sample-job",
  title: "Sample Backend Engineer role",
  location: "Remote",
  employmentType: "Full-time",
  seniorityLevel: "mid",
  rawDescription: "Develop and ship resilient backend services for the ETE test harness.",
  status: "Open",
  skills: [
    { name: "TypeScript", normalizedName: "typescript", required: true, weight: 2 },
    { name: "Node.js", normalizedName: "node.js", required: true, weight: 1.5 },
    { name: "PostgreSQL", normalizedName: "postgresql", required: false, weight: 1 },
    { name: "AWS", normalizedName: "aws", required: false, weight: 1 },
  ],
};

const SAMPLE_CANDIDATES: SampleCandidate[] = [
  {
    id: "eat-sample-candidate-1",
    fullName: "Casey Harper",
    location: "Remote",
    currentTitle: "Backend Engineer",
    totalExperienceYears: 6,
    seniorityLevel: "mid",
    summary: "Backend engineer focused on TypeScript services and operational excellence.",
    normalizedSkills: ["typescript", "node.js", "postgresql", "aws"],
    skills: [
      { name: "TypeScript", normalizedName: "typescript", proficiency: "High", yearsOfExperience: 4 },
      { name: "Node.js", normalizedName: "node.js", proficiency: "High", yearsOfExperience: 5 },
      { name: "PostgreSQL", normalizedName: "postgresql", proficiency: "Medium", yearsOfExperience: 3 },
      { name: "AWS", normalizedName: "aws", proficiency: "Medium", yearsOfExperience: 3 },
    ],
  },
  {
    id: "eat-sample-candidate-2",
    fullName: "Jordan Lee",
    location: "Austin, TX",
    currentTitle: "Platform Engineer",
    totalExperienceYears: 8,
    seniorityLevel: "senior",
    summary: "Platform engineer with experience hardening Node.js workloads and observability.",
    normalizedSkills: ["typescript", "node.js", "aws", "kubernetes"],
    skills: [
      { name: "TypeScript", normalizedName: "typescript", proficiency: "High", yearsOfExperience: 6 },
      { name: "Node.js", normalizedName: "node.js", proficiency: "High", yearsOfExperience: 7 },
      { name: "AWS", normalizedName: "aws", proficiency: "High", yearsOfExperience: 6 },
      { name: "Kubernetes", normalizedName: "kubernetes", proficiency: "Medium", yearsOfExperience: 4 },
    ],
  },
  {
    id: "eat-sample-candidate-3",
    fullName: "Taylor Morgan",
    location: "New York, NY",
    currentTitle: "Full Stack Engineer",
    totalExperienceYears: 5,
    seniorityLevel: "mid",
    summary: "Full stack engineer building APIs and data flows with PostgreSQL backends.",
    normalizedSkills: ["typescript", "react", "node.js", "postgresql"],
    skills: [
      { name: "TypeScript", normalizedName: "typescript", proficiency: "High", yearsOfExperience: 4 },
      { name: "React", normalizedName: "react", proficiency: "High", yearsOfExperience: 4 },
      { name: "Node.js", normalizedName: "node.js", proficiency: "Medium", yearsOfExperience: 4 },
      { name: "PostgreSQL", normalizedName: "postgresql", proficiency: "Medium", yearsOfExperience: 3 },
    ],
  },
];

function withTenantPrefix(baseId: string, tenantId: string) {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `${baseId}-${safeTenant}`;
}

async function upsertJob(tenantId: string, job: SampleJob) {
  const jobId = withTenantPrefix(job.id, tenantId);
  const skills = job.skills.map((skill) => ({
    tenantId,
    jobReqId: jobId,
    name: skill.name,
    normalizedName: skill.normalizedName,
    required: Boolean(skill.required),
    weight: skill.weight ?? null,
  }));

  await prisma.jobSkill.deleteMany({ where: { jobReqId: jobId, tenantId } });

  await prisma.jobReq.upsert({
    where: { id: jobId },
    create: {
      id: jobId,
      tenantId,
      title: job.title,
      location: job.location,
      employmentType: job.employmentType,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryInterval: null,
      seniorityLevel: job.seniorityLevel,
      rawDescription: job.rawDescription,
      status: job.status,
      sourceType: "seeded",
      sourceTag: "eat-sample",
      skills: {
        create: skills,
      },
    },
    update: {
      tenantId,
      title: job.title,
      location: job.location,
      employmentType: job.employmentType,
      seniorityLevel: job.seniorityLevel,
      rawDescription: job.rawDescription,
      status: job.status,
      sourceType: "seeded",
      sourceTag: "eat-sample",
      skills: {
        create: skills,
      },
    },
  });

  return jobId;
}

async function upsertCandidate(tenantId: string, candidate: SampleCandidate, jobReqId: string) {
  const candidateId = withTenantPrefix(candidate.id, tenantId);
  const skills = candidate.skills.map((skill) => ({
    tenantId,
    candidateId,
    name: skill.name,
    normalizedName: skill.normalizedName,
    proficiency: skill.proficiency ?? null,
    yearsOfExperience: skill.yearsOfExperience ?? null,
  }));

  await prisma.candidateSkill.deleteMany({ where: { candidateId, tenantId } });

  await prisma.candidate.upsert({
    where: { id: candidateId },
    create: {
      id: candidateId,
      tenantId,
      fullName: candidate.fullName,
      email: null,
      phone: null,
      location: candidate.location,
      currentTitle: candidate.currentTitle,
      currentCompany: null,
      totalExperienceYears: candidate.totalExperienceYears,
      seniorityLevel: candidate.seniorityLevel,
      summary: candidate.summary,
      rawResumeText: null,
      sourceType: "seeded",
      sourceTag: "eat-sample",
      parsingConfidence: null,
      trustScore: null,
      status: "Active",
      normalizedSkills: candidate.normalizedSkills,
      skills: {
        create: skills,
      },
    },
    update: {
      tenantId,
      fullName: candidate.fullName,
      location: candidate.location,
      currentTitle: candidate.currentTitle,
      totalExperienceYears: candidate.totalExperienceYears,
      seniorityLevel: candidate.seniorityLevel,
      summary: candidate.summary,
      normalizedSkills: candidate.normalizedSkills,
      sourceType: "seeded",
      sourceTag: "eat-sample",
      skills: {
        create: skills,
      },
    },
  });

  const jobCandidateId = `${jobReqId}-${candidateId}`;

  await prisma.jobCandidate.upsert({
    where: { id: jobCandidateId },
    create: {
      id: jobCandidateId,
      tenantId,
      jobReqId,
      candidateId,
      status: JobCandidateStatus.POTENTIAL,
    },
    update: { status: JobCandidateStatus.POTENTIAL },
  });

  return candidateId;
}

export async function seedEatSampleData(tenantId?: string) {
  const resolvedTenantId = (tenantId ?? DEFAULT_TENANT_ID).trim();
  const jobReqId = await upsertJob(resolvedTenantId, SAMPLE_JOB);

  const candidateIds: string[] = [];

  for (const candidate of SAMPLE_CANDIDATES) {
    const id = await upsertCandidate(resolvedTenantId, candidate, jobReqId);
    candidateIds.push(id);
  }

  return { jobReqId, candidateIds };
}
