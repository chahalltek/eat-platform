import { AgentRunStatus, JobCandidateStatus, PrismaClient } from '@prisma/client';

import { DEFAULT_TENANT_ID } from '../src/lib/auth/config';
import { FEATURE_FLAGS, setFeatureFlag } from '../src/lib/featureFlags';

const prisma = new PrismaClient();

const ADMIN_USER_ID = 'admin-user';
const RECRUITER_USER_ID = 'charlie';

function daysAgo(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

async function seedTenant() {
  return prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: { name: 'Default Tenant', status: 'active' },
    create: { id: DEFAULT_TENANT_ID, name: 'Default Tenant', status: 'active' },
  });
}

async function seedTenantMode() {
  await prisma.tenantMode.upsert({
    where: { tenantId: DEFAULT_TENANT_ID },
    update: { mode: 'pilot' },
    create: { tenantId: DEFAULT_TENANT_ID, mode: 'pilot' },
  });
}

async function seedUsers() {
  const users = [
    {
      id: RECRUITER_USER_ID,
      email: 'recruiter@test.demo',
      displayName: 'Test Recruiter',
      role: 'RECRUITER',
    },
    {
      id: ADMIN_USER_ID,
      email: 'admin@test.demo',
      displayName: 'Admin',
      role: 'Admin',
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { ...user, tenantId: DEFAULT_TENANT_ID },
      create: { ...user, tenantId: DEFAULT_TENANT_ID },
    });
  }
}

async function seedTenantMemberships() {
  await prisma.tenantUser.upsert({
    where: {
      userId_tenantId: {
        userId: ADMIN_USER_ID,
        tenantId: DEFAULT_TENANT_ID,
      },
    },
    update: { role: 'ADMIN' },
    create: {
      id: 'admin-default-tenant',
      userId: ADMIN_USER_ID,
      tenantId: DEFAULT_TENANT_ID,
      role: 'ADMIN',
    },
  });
}

async function resetTenantData() {
  await prisma.outreachInteraction.deleteMany({ where: { tenantId: DEFAULT_TENANT_ID } });
  await prisma.matchResult.deleteMany({ where: { tenantId: DEFAULT_TENANT_ID } });
  await prisma.match.deleteMany({ where: { tenantId: DEFAULT_TENANT_ID } });
  await prisma.jobCandidate.deleteMany({ where: { tenantId: DEFAULT_TENANT_ID } });
  await prisma.agentRunLog.deleteMany({ where: { tenantId: DEFAULT_TENANT_ID } });
  await prisma.candidateSkill.deleteMany({ where: { tenantId: DEFAULT_TENANT_ID } });
  await prisma.jobSkill.deleteMany({ where: { tenantId: DEFAULT_TENANT_ID } });
  await prisma.candidate.deleteMany({ where: { tenantId: DEFAULT_TENANT_ID } });
  await prisma.jobReq.deleteMany({ where: { tenantId: DEFAULT_TENANT_ID } });
  await prisma.customer.deleteMany({ where: { tenantId: DEFAULT_TENANT_ID } });
}

async function seedJobs() {
  const customers = [
    { id: 'cust-apex', name: 'Apex Analytics' },
    { id: 'cust-northern', name: 'Northern Health' },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: { ...customer, tenantId: DEFAULT_TENANT_ID },
      create: { ...customer, tenantId: DEFAULT_TENANT_ID },
    });
  }

  const jobReqs = [
    {
      id: 'job-fullstack',
      customerId: 'cust-apex',
      title: 'Senior Full Stack Engineer',
      location: 'Seattle, WA',
      employmentType: 'Full-time',
      salaryMin: 165000,
      salaryMax: 190000,
      salaryCurrency: 'USD',
      salaryInterval: 'year',
      seniorityLevel: 'Senior',
      rawDescription:
        'Lead feature delivery for our analytics platform, shaping APIs and React front-ends while partnering closely with product.',
      status: 'Open',
      sourceType: 'Client Intake',
      sourceTag: 'Demo Week',
      createdAt: daysAgo(5),
      skills: [
        { name: 'TypeScript', normalizedName: 'typescript', required: true, weight: 0.35 },
        { name: 'React', normalizedName: 'react', required: true, weight: 0.35 },
        { name: 'Node.js', normalizedName: 'nodejs', required: false, weight: 0.2 },
        { name: 'PostgreSQL', normalizedName: 'postgresql', required: false, weight: 0.1 },
      ],
    },
    {
      id: 'job-ml',
      customerId: 'cust-northern',
      title: 'Machine Learning Scientist',
      location: 'New York, NY',
      employmentType: 'Hybrid',
      salaryMin: 175000,
      salaryMax: 205000,
      salaryCurrency: 'USD',
      salaryInterval: 'year',
      seniorityLevel: 'Staff',
      rawDescription:
        'Deploy patient risk models, own experiment design, and guide production ML pipelines with the data engineering team.',
      status: 'Open',
      sourceType: 'RFP',
      sourceTag: 'Healthcare',
      createdAt: daysAgo(7),
      skills: [
        { name: 'Python', normalizedName: 'python', required: true, weight: 0.4 },
        { name: 'Machine Learning', normalizedName: 'machine learning', required: true, weight: 0.35 },
        { name: 'MLOps', normalizedName: 'mlops', required: false, weight: 0.15 },
        { name: 'Experiment Design', normalizedName: 'experiment design', required: false, weight: 0.1 },
      ],
    },
  ];

  for (const job of jobReqs) {
    const { skills, ...jobData } = job;

    await prisma.jobReq.upsert({
      where: { id: job.id },
      update: { ...jobData, createdAt: job.createdAt, tenantId: DEFAULT_TENANT_ID },
      create: { ...jobData, tenantId: DEFAULT_TENANT_ID },
    });

    await prisma.jobSkill.deleteMany({ where: { jobReqId: job.id, tenantId: DEFAULT_TENANT_ID } });
    await prisma.jobSkill.createMany({
      data: skills.map((skill) => ({ ...skill, jobReqId: job.id, tenantId: DEFAULT_TENANT_ID })),
    });
  }
}

async function seedCandidates() {
  const candidates = [
    {
      id: 'cand-jordan-lee',
      fullName: 'Jordan Lee',
      email: 'jordan.lee@example.com',
      phone: '(555) 201-8800',
      location: 'Seattle, WA',
      currentTitle: 'Senior Software Engineer',
      currentCompany: 'Aurora Labs',
      totalExperienceYears: 9,
      seniorityLevel: 'Senior',
      summary:
        'Full-stack engineer with deep TypeScript expertise. Owns delivery from React front-ends through Node services with a focus on observability.',
      rawResumeText:
        'Jordan Lee\nSeattle, WA\nSenior Software Engineer\n- Built customer analytics portal in React + Next.js\n- Designed Node.js services and Postgres schema for auditability\n- Led migration to TypeScript-first codebase',
      sourceType: 'Referral',
      sourceTag: 'Demo Set',
      parsingConfidence: 0.92,
      status: 'Active',
      createdAt: daysAgo(6),
      skills: [
        { name: 'TypeScript', normalizedName: 'typescript', proficiency: 'High', yearsOfExperience: 5 },
        { name: 'React', normalizedName: 'react', proficiency: 'High', yearsOfExperience: 5 },
        { name: 'Node.js', normalizedName: 'nodejs', proficiency: 'Medium', yearsOfExperience: 4 },
      ],
    },
    {
      id: 'cand-priya-patel',
      fullName: 'Priya Patel',
      email: 'priya.patel@example.com',
      phone: '(555) 445-1180',
      location: 'New York, NY',
      currentTitle: 'Applied Scientist',
      currentCompany: 'Urban Insights',
      totalExperienceYears: 8,
      seniorityLevel: 'Staff',
      summary:
        'Applied scientist focused on healthcare outcomes. Designs experiments, builds ML models, and partners with data engineers for production rollouts.',
      rawResumeText:
        'Priya Patel\nApplied Scientist\n- Delivered patient risk scoring model with measurable lift\n- Productionized ML pipelines with feature store integration\n- Championed experiment design practices across teams',
      sourceType: 'Upload',
      sourceTag: 'Healthcare',
      parsingConfidence: 0.88,
      status: 'Interviewing',
      createdAt: daysAgo(4),
      skills: [
        { name: 'Python', normalizedName: 'python', proficiency: 'High', yearsOfExperience: 6 },
        { name: 'Machine Learning', normalizedName: 'machine learning', proficiency: 'High', yearsOfExperience: 6 },
        { name: 'MLOps', normalizedName: 'mlops', proficiency: 'Medium', yearsOfExperience: 3 },
      ],
    },
    {
      id: 'cand-marcus-chen',
      fullName: 'Marcus Chen',
      email: 'marcus.chen@example.com',
      phone: '(555) 880-4411',
      location: 'Austin, TX',
      currentTitle: 'DevOps Engineer',
      currentCompany: 'Cloud City',
      totalExperienceYears: 7,
      seniorityLevel: 'Mid',
      summary:
        'DevOps engineer keeping releases healthy. Builds CI/CD, observability, and incident response playbooks for cross-functional teams.',
      rawResumeText:
        'Marcus Chen\nDevOps Engineer\n- Built GitHub Actions pipelines with automated previews\n- Owned Kubernetes rollout and on-call runbooks\n- Partnered with SREs on observability baselines',
      sourceType: 'Sourcing',
      sourceTag: 'CloudOps',
      parsingConfidence: 0.81,
      status: 'Potential',
      createdAt: daysAgo(3),
      skills: [
        { name: 'Kubernetes', normalizedName: 'kubernetes', proficiency: 'High', yearsOfExperience: 4 },
        { name: 'AWS', normalizedName: 'aws', proficiency: 'High', yearsOfExperience: 5 },
        { name: 'CI/CD', normalizedName: 'ci/cd', proficiency: 'Medium', yearsOfExperience: 4 },
      ],
    },
  ];

  for (const candidate of candidates) {
    const { skills, ...candidateData } = candidate;

    await prisma.candidate.upsert({
      where: { id: candidate.id },
      update: { ...candidateData, createdAt: candidate.createdAt, tenantId: DEFAULT_TENANT_ID },
      create: { ...candidateData, tenantId: DEFAULT_TENANT_ID },
    });

    await prisma.candidateSkill.deleteMany({ where: { candidateId: candidate.id, tenantId: DEFAULT_TENANT_ID } });
    await prisma.candidateSkill.createMany({
      data: skills.map((skill) => ({ ...skill, candidateId: candidate.id, tenantId: DEFAULT_TENANT_ID })),
    });
  }
}

async function seedAgentRuns() {
  const runs = [
    {
      id: 'run-jordan-match',
      agentName: 'ETE-TS.RINA',
      status: AgentRunStatus.SUCCESS,
      userId: 'charlie',
      sourceType: 'Matching',
      sourceTag: 'Demo',
      input: { candidateId: 'cand-jordan-lee', jobReqId: 'job-fullstack' },
      output: { score: 88, rationale: 'Strong React/TypeScript alignment with leadership experience.' },
      startedAt: daysAgo(1),
      finishedAt: daysAgo(1),
    },
    {
      id: 'run-priya-match',
      agentName: 'ETE-TS.RINA',
      status: AgentRunStatus.SUCCESS,
      userId: 'charlie',
      sourceType: 'Matching',
      sourceTag: 'Demo',
      input: { candidateId: 'cand-priya-patel', jobReqId: 'job-ml' },
      output: { score: 92, rationale: 'Healthcare ML background maps directly to requirements.' },
      startedAt: daysAgo(2),
      finishedAt: daysAgo(2),
    },
    {
      id: 'run-marcus-outreach',
      agentName: 'ETE-TS.RINA',
      status: AgentRunStatus.FAILED,
      userId: 'charlie',
      sourceType: 'Outreach',
      sourceTag: 'Demo',
      input: { candidateId: 'cand-marcus-chen', jobReqId: 'job-fullstack' },
      output: { error: 'SMTP connection refused', attempt: 1 },
      errorMessage: 'SMTP connection refused',
      startedAt: daysAgo(3),
      finishedAt: daysAgo(3),
    },
  ];

  for (const run of runs) {
    const runData = {
      ...run,
      tenantId: DEFAULT_TENANT_ID,
      inputSnapshot: run.input,
      outputSnapshot: run.output ?? run.errorMessage ?? null,
    };

    await prisma.agentRunLog.upsert({
      where: { id: run.id },
      update: runData,
      create: runData,
    });
  }
}

async function seedMatchesAndOutreach() {
  const jobCandidates = [
    {
      id: 'jobcand-jordan-fullstack',
      jobReqId: 'job-fullstack',
      candidateId: 'cand-jordan-lee',
      status: JobCandidateStatus.SUBMITTED,
      userId: 'charlie',
      matchResultId: 'match-jordan-fullstack',
      matchScore: 88,
      agentRunId: 'run-jordan-match',
      createdAt: daysAgo(1),
    },
    {
      id: 'jobcand-priya-ml',
      jobReqId: 'job-ml',
      candidateId: 'cand-priya-patel',
      status: JobCandidateStatus.INTERVIEWING,
      userId: 'charlie',
      matchResultId: 'match-priya-ml',
      matchScore: 92,
      agentRunId: 'run-priya-match',
      createdAt: daysAgo(2),
    },
    {
      id: 'jobcand-marcus-fullstack',
      jobReqId: 'job-fullstack',
      candidateId: 'cand-marcus-chen',
      status: JobCandidateStatus.POTENTIAL,
      userId: 'charlie',
      matchResultId: 'match-marcus-fullstack',
      matchScore: 70,
      agentRunId: 'run-marcus-outreach',
      createdAt: daysAgo(3),
    },
  ];

  for (const jobCandidate of jobCandidates) {
    const record = await prisma.jobCandidate.upsert({
      where: {
        tenantId_jobReqId_candidateId: {
          tenantId: DEFAULT_TENANT_ID,
          jobReqId: jobCandidate.jobReqId,
          candidateId: jobCandidate.candidateId,
        },
      },
      update: {
        status: jobCandidate.status,
        userId: jobCandidate.userId,
        createdAt: jobCandidate.createdAt,
        tenantId: DEFAULT_TENANT_ID,
      },
      create: {
        id: jobCandidate.id,
        jobReqId: jobCandidate.jobReqId,
        candidateId: jobCandidate.candidateId,
        status: jobCandidate.status,
        userId: jobCandidate.userId,
        createdAt: jobCandidate.createdAt,
        tenantId: DEFAULT_TENANT_ID,
      },
    });

    const match = await prisma.matchResult.upsert({
      where: { id: jobCandidate.matchResultId },
      update: {
        score: jobCandidate.matchScore,
        reasons: { summary: 'Demo match score for seeded data.' },
        candidateId: jobCandidate.candidateId,
        jobReqId: jobCandidate.jobReqId,
        jobCandidateId: record.id,
        createdAt: jobCandidate.createdAt,
        agentRunId: jobCandidate.agentRunId,
        tenantId: DEFAULT_TENANT_ID,
      },
      create: {
        id: jobCandidate.matchResultId,
        score: jobCandidate.matchScore,
        reasons: { summary: 'Demo match score for seeded data.' },
        candidateId: jobCandidate.candidateId,
        jobReqId: jobCandidate.jobReqId,
        jobCandidateId: record.id,
        createdAt: jobCandidate.createdAt,
        agentRunId: jobCandidate.agentRunId,
        tenantId: DEFAULT_TENANT_ID,
      },
    });

    await prisma.jobCandidate.update({
      where: { id: record.id },
      data: { lastMatchResultId: match.id },
    });

    await prisma.outreachInteraction.upsert({
      where: { id: `${record.id}-outreach` },
      update: {
        candidateId: record.candidateId,
        jobReqId: record.jobReqId,
        agentRunId: jobCandidate.agentRunId,
        tenantId: DEFAULT_TENANT_ID,
        createdAt: jobCandidate.createdAt,
      },
      create: {
        id: `${record.id}-outreach`,
        candidateId: record.candidateId,
        jobReqId: record.jobReqId,
        agentRunId: jobCandidate.agentRunId,
        tenantId: DEFAULT_TENANT_ID,
        createdAt: jobCandidate.createdAt,
      },
    });
  }
}

async function main() {
  await seedTenant();
  await seedTenantMode();
  await seedUsers();
  await seedTenantMemberships();
  await resetTenantData();
  await seedJobs();
  await seedCandidates();
  await seedAgentRuns();
  await seedMatchesAndOutreach();

  await Promise.all(
    Object.values(FEATURE_FLAGS).map((flagName) => setFeatureFlag(flagName, false)),
  );
}

main()
  .then(() => console.log('Seeded'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
