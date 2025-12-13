import {
  AgentRunStatus,
  JobCandidateStatus,
  PrismaClient,
  type Prisma,
} from '@prisma/client';

import { FEATURE_FLAGS, setFeatureFlag } from '../src/lib/featureFlags';
import { defaultTenantGuardrails } from '../src/lib/guardrails/defaultTenantConfig';
import { withTenantContext } from '../src/lib/tenant';

const ADMIN_USER_ID = 'admin-user';
const RECRUITER_USER_ID = 'charlie';
const DEFAULT_AGENT_FLAGS = [
  'ETE-SOURCER',
  'ETE-TS.RUA',
  'ETE-TS.RINA',
  'ETE-TS.MATCH',
  'ETE-TS.MATCHER',
  'ETE-TS.SHORTLIST',
  'ETE-TS.CONFIDENCE',
  'ETE-TS.EXPLAIN',
  'ETE-TS.SHORTLISTS',
];

function daysAgo(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

async function seedTenant(prisma: PrismaClient, tenantId: string, tenantName: string) {
  return prisma.tenant.upsert({
    where: { id: tenantId },
    update: { name: tenantName, status: 'active' },
    create: { id: tenantId, name: tenantName, status: 'active' },
  });
}

async function seedTenantMode(prisma: PrismaClient, tenantId: string, mode: string) {
  await prisma.tenantMode.upsert({
    where: { tenantId },
    update: { mode },
    create: { tenantId, mode },
  });
}

async function seedSystemMode(
  prisma: PrismaClient,
  tenantId: string,
  mode: string,
  metadata: Prisma.InputJsonValue = {},
) {
  await prisma.systemMode.upsert({
    where: { tenantId },
    update: { mode, metadata },
    create: { tenantId, mode, metadata },
  });
}

async function seedUsers(prisma: PrismaClient, tenantId: string) {
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
      update: { ...user, tenantId },
      create: { ...user, tenantId },
    });
  }
}

async function seedTenantMemberships(prisma: PrismaClient, tenantId: string) {
  await prisma.tenantUser.upsert({
    where: {
      userId_tenantId: {
        userId: ADMIN_USER_ID,
        tenantId,
      },
    },
    update: { role: 'ADMIN' },
    create: {
      id: 'admin-default-tenant',
      userId: ADMIN_USER_ID,
      tenantId,
      role: 'ADMIN',
    },
  });
}

async function seedTenantConfig(prisma: PrismaClient, tenantId: string, preset: string) {
  await prisma.tenantConfig.upsert({
    where: { tenantId },
    update: {
      preset,
      scoring: defaultTenantGuardrails.scoring,
      explain: defaultTenantGuardrails.explain,
      safety: defaultTenantGuardrails.safety,
      llm: defaultTenantGuardrails.llm,
      networkLearningOptIn: false,
      networkLearning: { enabled: false },
    },
    create: {
      tenantId,
      preset,
      scoring: defaultTenantGuardrails.scoring,
      explain: defaultTenantGuardrails.explain,
      safety: defaultTenantGuardrails.safety,
      llm: defaultTenantGuardrails.llm,
      networkLearningOptIn: false,
      networkLearning: { enabled: false },
    },
  });
}

async function resetTenantData(prisma: PrismaClient, tenantId: string) {
  await prisma.outreachInteraction.deleteMany({ where: { tenantId } });
  await prisma.matchResult.deleteMany({ where: { tenantId } });
  await prisma.match.deleteMany({ where: { tenantId } });
  await prisma.jobCandidate.deleteMany({ where: { tenantId } });
  await prisma.agentRunLog.deleteMany({ where: { tenantId } });
  await prisma.candidateSkill.deleteMany({ where: { tenantId } });
  await prisma.jobSkill.deleteMany({ where: { tenantId } });
  await prisma.candidate.deleteMany({ where: { tenantId } });
  await prisma.jobReq.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
}

async function seedAgentFlags(prisma: PrismaClient, tenantId: string) {
  for (const agentName of DEFAULT_AGENT_FLAGS) {
    await prisma.agentFlag.upsert({
      where: {
        tenantId_agentName: { tenantId, agentName },
      },
      update: {},
      create: {
        tenantId,
        agentName,
        enabled: true,
      },
    });
  }
}

async function seedJobs(prisma: PrismaClient, tenantId: string) {
  const customers = [
    { id: 'cust-apex', name: 'Apex Analytics' },
    { id: 'cust-northern', name: 'Northern Health' },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: { ...customer, tenantId },
      create: { ...customer, tenantId },
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
      update: { ...jobData, createdAt: job.createdAt, tenantId },
      create: { ...jobData, tenantId },
    });

    await prisma.jobSkill.deleteMany({ where: { jobReqId: job.id, tenantId } });
    await prisma.jobSkill.createMany({
      data: skills.map((skill) => ({ ...skill, jobReqId: job.id, tenantId })),
    });
  }
}

async function seedCandidates(prisma: PrismaClient, tenantId: string) {
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
      update: { ...candidateData, createdAt: candidate.createdAt, tenantId },
      create: { ...candidateData, tenantId },
    });

    await prisma.candidateSkill.deleteMany({ where: { candidateId: candidate.id, tenantId } });
    await prisma.candidateSkill.createMany({
      data: skills.map((skill) => ({ ...skill, candidateId: candidate.id, tenantId })),
    });
  }
}

async function seedAgentRuns(prisma: PrismaClient, tenantId: string) {
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
      tenantId,
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

async function seedMatchesAndOutreach(prisma: PrismaClient, tenantId: string) {
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
      where: { id: jobCandidate.id },
      update: {
        status: jobCandidate.status,
        userId: jobCandidate.userId,
        createdAt: jobCandidate.createdAt,
        tenantId,
      },
      create: {
        id: jobCandidate.id,
        jobReqId: jobCandidate.jobReqId,
        candidateId: jobCandidate.candidateId,
        status: jobCandidate.status,
        userId: jobCandidate.userId,
        tenantId,
        createdAt: jobCandidate.createdAt,
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
        tenantId,
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
        tenantId,
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
        tenantId,
        createdAt: jobCandidate.createdAt,
      },
      create: {
        id: `${record.id}-outreach`,
        candidateId: record.candidateId,
        jobReqId: record.jobReqId,
        agentRunId: jobCandidate.agentRunId,
        tenantId,
        createdAt: jobCandidate.createdAt,
      },
    });
  }
}

async function seedLearningAggregates(prisma: PrismaClient) {
  const aggregates = [
    {
      roleFamily: 'Engineering',
      region: 'US',
      signalType: 'time_to_fill',
      value: 42,
      sampleSize: 240,
      windowDays: 90,
    },
    {
      roleFamily: 'Data',
      region: 'US',
      signalType: 'scarcity_index',
      value: 1.35,
      sampleSize: 180,
      windowDays: 90,
    },
    {
      roleFamily: 'Sales',
      region: 'EMEA',
      signalType: 'time_to_fill',
      value: 35,
      sampleSize: 120,
      windowDays: 90,
    },
  ];

  await prisma.learningAggregate.deleteMany({
    where: {
      OR: aggregates.map((entry) => ({
        roleFamily: entry.roleFamily,
        region: entry.region,
        signalType: entry.signalType,
      })),
    },
  });
  await prisma.learningAggregate.createMany({ data: aggregates });
}

async function seedBenchmarkRelease(prisma: PrismaClient) {
  const releaseId = '2026-Q1';

  await prisma.benchmarkRelease.upsert({
    where: { id: releaseId },
    update: { status: 'published', publishedAt: new Date('2026-02-15T00:00:00Z') },
    create: {
      id: releaseId,
      version: '2026-Q1',
      status: 'published',
      windowDays: 90,
      publishedAt: new Date('2026-02-15T00:00:00Z'),
    },
  });

  const metrics = [
    {
      releaseId,
      roleFamily: 'Engineering',
      region: 'US',
      metricKey: 'time-to-fill',
      metricValue: 42,
      sampleSize: 240,
      methodologyNotes: 'Aggregated for demo guardrails; no tenant-level leakage.',
    },
    {
      releaseId,
      roleFamily: 'Data',
      region: 'US',
      metricKey: 'scarcity-index',
      metricValue: 1.35,
      sampleSize: 180,
      methodologyNotes: 'Precomputed for demo stability.',
    },
    {
      releaseId,
      roleFamily: 'Sales',
      region: 'EMEA',
      metricKey: 'market-heatmap',
      metricValue: 0.85,
      sampleSize: 120,
      methodologyNotes: 'Regional heatmap derived from anonymized demo signals.',
    },
  ];

  await prisma.benchmarkMetric.deleteMany({ where: { releaseId } });
  await prisma.benchmarkMetric.createMany({ data: metrics });

  return releaseId;
}

async function seedInsightSnapshots(prisma: PrismaClient, releaseId: string) {
  await prisma.insightSnapshot.deleteMany({ where: { releaseId } });

  await prisma.insightSnapshot.create({
    data: {
      releaseId,
      title: 'Demo hiring velocity stays predictable',
      subtitle: 'Precomputed benchmarks keep demo tenants stable and ready.',
      audience: 'public',
      status: 'published',
      publishedAt: new Date('2026-02-20T00:00:00Z'),
      contentJson: {
        headline: 'Median time-to-fill sits at 42 days for demo engineering roles',
        subtitle: 'Guardrails freeze learning to avoid cross-tenant noise while keeping insights fresh.',
        chart: {
          type: 'line',
          units: 'days',
          series: [
            { label: '2025-Q4', value: 45, sampleSize: 200 },
            { label: '2026-Q1', value: 42, sampleSize: 240 },
          ],
        },
        interpretation: [
          'Demo mode uses pre-aggregated signals; no tenant resumes or reqs are streamed into learning.',
          'Benchmarks refresh with seeded data only, ensuring no cleanup after live demos.',
        ],
        methodology:
          'Aggregated for demo use only with learning paused and external writes disabled; no tenant-specific data stored.',
        meta: {
          releaseId,
          metricKey: 'time-to-fill',
          filters: { roleFamily: 'Engineering', region: 'US' },
          templateKey: 'time-to-fill',
        },
      },
    },
  });
}

export type SeedTenantOptions = {
  tenantId: string;
  tenantName?: string;
  tenantMode?: string;
  systemMode?: string;
  resetTenantData?: boolean;
};

export async function seedDemoTenant(prisma: PrismaClient, options: SeedTenantOptions) {
  const { tenantId, tenantMode = 'pilot', systemMode = 'demo', tenantName = 'Demo Tenant' } = options;

  await seedTenant(prisma, tenantId, tenantName);
  await seedTenantMode(prisma, tenantId, tenantMode);
  await seedSystemMode(prisma, tenantId, systemMode, {
    guardrailsPreset: 'demo-safe',
    agentEnablement: { basic: true, shortlist: true, agents: false },
  });
  await seedUsers(prisma, tenantId);
  await seedTenantMemberships(prisma, tenantId);
  await seedTenantConfig(prisma, tenantId, 'demo-safe');

  if (options.resetTenantData ?? true) {
    await resetTenantData(prisma, tenantId);
  }

  await seedJobs(prisma, tenantId);
  await seedCandidates(prisma, tenantId);
  await seedAgentFlags(prisma, tenantId);
  await seedAgentRuns(prisma, tenantId);
  await seedMatchesAndOutreach(prisma, tenantId);
  await seedLearningAggregates(prisma);
  const releaseId = await seedBenchmarkRelease(prisma);
  await seedInsightSnapshots(prisma, releaseId);

  await withTenantContext(tenantId, async () => {
    await Promise.all(Object.values(FEATURE_FLAGS).map((flagName) => setFeatureFlag(flagName, false)));
  });
}
