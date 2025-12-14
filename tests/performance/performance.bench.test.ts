import { performance } from 'node:perf_hooks';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { sanitizeExtractedText } from '@/lib/uploads';
import { computeMatchScore } from '@/lib/matching/msa';
import { mockDb } from '@/test-helpers/db';
import type { Candidate, CandidateSkill, JobReq, JobSkill } from '@/server/db';

const { prisma, resetDbMocks } = mockDb();

vi.mock('@/lib/llm', () => ({
  callLLM: vi.fn(async () =>
    JSON.stringify({
      fullName: 'Benchmark Candidate',
      email: 'benchmark@example.com',
      phone: '555-123-4567',
      location: 'Remote',
      currentTitle: 'Senior Engineer',
      currentCompany: 'Speedy Systems',
      totalExperienceYears: 8,
      seniorityLevel: 'Senior',
      summary: 'Engineering leader focused on throughput and reliability.',
      warnings: [],
      skills: [
        { name: 'TypeScript', normalizedName: 'typescript', proficiency: 'expert', yearsOfExperience: 5 },
        { name: 'React', normalizedName: 'react', proficiency: 'advanced', yearsOfExperience: 4 },
      ],
      parsingConfidence: 0.94,
    }),
  ),
}));

vi.mock('@/lib/agents/agentRun', () => ({
  withAgentRun: vi.fn(async (_meta, handler) => {
    const result = await handler();
    return [result.result, 'agent-run-benchmark'];
  }),
}));

const PERFORMANCE_BASELINES = {
  resumeParsingMs: 4,
  matchingMs: 5,
  agentResponseMs: 15,
};

const DRIFT_TOLERANCE = 1.25;

const largeResumeText = Array.from({ length: 200 }, (_, idx) =>
  `Candidate section ${idx}: Experienced engineer with expertise in distributed systems, TypeScript, and React.`,
).join('\n');

function measureSync(fn: () => void, iterations: number) {
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    fn();
  }
  const duration = performance.now() - start;
  return { totalMs: duration, avgMs: duration / iterations };
}

async function measureAsync(fn: () => Promise<unknown>, iterations: number) {
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    await fn();
  }
  const duration = performance.now() - start;
  return { totalMs: duration, avgMs: duration / iterations };
}

describe('Performance baselines', () => {
  beforeEach(() => {
    resetDbMocks();
    prisma.candidate.create.mockImplementation(async ({ data }) => ({ id: 'candidate-benchmark', ...data }));
    vi.clearAllMocks();
  });

  it('keeps resume parsing within baseline', () => {
    const resumePayload = `${largeResumeText}\n\n${'Key Skills: JavaScript, Node.js, Kubernetes '.repeat(10)}`;

    const result = measureSync(() => sanitizeExtractedText(resumePayload), 150);

    expect(result.avgMs).toBeLessThanOrEqual(PERFORMANCE_BASELINES.resumeParsingMs);
    expect(result.avgMs).toBeLessThanOrEqual(PERFORMANCE_BASELINES.resumeParsingMs * DRIFT_TOLERANCE);
  });

  it('keeps matching within baseline', () => {
    const candidate: Candidate & { skills: CandidateSkill[] } = {
      id: 'cand-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      fullName: 'Match Tester',
      summary: 'Seasoned engineer with frontend and backend experience.',
      rawResumeText: largeResumeText,
      email: 'candidate@example.com',
      phone: '123-456-7890',
      location: 'San Francisco',
      currentTitle: 'Staff Engineer',
      currentCompany: 'Tech Corp',
      sourceType: 'inbound',
      sourceTag: 'referral',
      totalExperienceYears: 10,
      seniorityLevel: 'Senior',
      parsingConfidence: 0.9,
      skills: Array.from({ length: 40 }, (_, idx) => ({
        id: `cand-skill-${idx}`,
        candidateId: 'cand-1',
        name: `Skill ${idx}`,
        normalizedName: idx % 2 === 0 ? `skill-${idx}` : undefined,
        proficiency: null,
        yearsOfExperience: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    };

    const jobReq: JobReq & { skills: JobSkill[] } = {
      id: 'job-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      title: 'Full-stack Engineer',
      description: 'Work across the stack with TypeScript and React.',
      location: 'San Francisco',
      seniorityLevel: 'Senior',
      minCompensation: null,
      maxCompensation: null,
      minExperienceYears: 5,
      maxExperienceYears: 12,
      recruiterId: 'recruiter-1',
      skills: Array.from({ length: 25 }, (_, idx) => ({
        id: `job-skill-${idx}`,
        jobReqId: 'job-1',
        name: idx % 3 === 0 ? 'Skill 0' : `Skill ${idx}`,
        normalizedName: idx % 2 === 0 ? `skill-${idx}` : undefined,
        required: idx % 2 === 0,
        weight: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    };

    const result = measureSync(() => computeMatchScore({ candidate, jobReq }), 50);

    expect(result.avgMs).toBeLessThanOrEqual(PERFORMANCE_BASELINES.matchingMs);
    expect(result.avgMs).toBeLessThanOrEqual(PERFORMANCE_BASELINES.matchingMs * DRIFT_TOLERANCE);
  });

  it('keeps agent response time within baseline', async () => {
    const { runRina } = await import('@/lib/agents/rina');

    const result = await measureAsync(
      () =>
        runRina({
          rawResumeText: largeResumeText,
          sourceType: 'inbound',
          sourceTag: 'benchmark',
        }),
      10,
    );

    expect(result.avgMs).toBeLessThanOrEqual(PERFORMANCE_BASELINES.agentResponseMs);
    expect(result.avgMs).toBeLessThanOrEqual(PERFORMANCE_BASELINES.agentResponseMs * DRIFT_TOLERANCE);
  });
});
