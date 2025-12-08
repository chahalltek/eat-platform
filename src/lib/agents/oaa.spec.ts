/// <reference types="vitest/globals" />

import {
  DEFAULT_OAA_TEMPLATES,
  OAA_PROMPT_VERSION,
  runOutreachAutomation,
} from '@/lib/agents/oaa';
import { AgentBehaviorSpec, runAgentBehavior } from '@/lib/agents/testing/agentTestRunner';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => {
  return {
    prisma: {
      candidate: { findUnique: vi.fn() },
      jobReq: { findUnique: vi.fn() },
      match: { findFirst: vi.fn() },
      user: { findUnique: vi.fn() },
      outreachInteraction: { create: vi.fn() },
    },
  };
});

vi.mock('@/lib/agents/agentRun', () => {
  return {
    withAgentRun: vi.fn(async (_meta, handler) => {
      const outcome = await handler();
      return [outcome.result, 'agent-run-oaa'];
    }),
  };
});

describe('Outreach automation agent (OAA)', () => {
  const candidateRecord = {
    id: 'candidate-1',
    fullName: 'Sam Candidate',
    email: 'sam@example.com',
    phone: '555-555-1234',
    currentTitle: 'Backend Engineer',
    currentCompany: 'Acme Co',
    location: 'Remote',
    summary: null,
    totalExperienceYears: 6,
    seniorityLevel: 'senior',
    createdAt: new Date(),
    updatedAt: new Date(),
    skills: [
      { id: 'skill-1', name: 'Node.js', normalizedName: 'Node.js', proficiency: 'advanced', yearsOfExperience: 4, candidateId: 'candidate-1' },
      { id: 'skill-2', name: 'AWS', normalizedName: 'AWS', proficiency: 'intermediate', yearsOfExperience: 3, candidateId: 'candidate-1' },
    ],
  } as unknown;

  const jobReqRecord = {
    id: 'job-1',
    title: 'Lead Backend Engineer',
    location: 'Hybrid - NYC',
    employmentType: 'Full-time',
    seniorityLevel: 'senior',
    status: 'Open',
    rawDescription: 'Lead the core services team.',
    sourceType: 'internal',
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: { id: 'customer-1', name: 'Globex', contact: 'Jane', createdAt: new Date(), updatedAt: new Date() },
    skills: [
      { id: 'job-skill-1', jobReqId: 'job-1', name: 'Node.js', normalizedName: 'Node.js', required: true, weight: 0.5 },
      { id: 'job-skill-2', jobReqId: 'job-1', name: 'AWS', normalizedName: 'AWS', required: false, weight: 0.3 },
    ],
  } as unknown;

  const matchRecord = {
    id: 'match-1',
    jobReqId: 'job-1',
    candidateId: 'candidate-1',
    overallScore: 0.88,
    category: 'Strong Fit',
    scoreBreakdown: {},
    explanation: 'Your Node.js leadership fits the role focus on backend services.',
    redFlags: null,
    status: 'Suggested',
    createdAt: new Date(),
    createdByAgent: 'matching-engine',
  } as unknown;

  const recruiterRecord = {
    id: 'user-1',
    email: 'recruiter@example.com',
    displayName: 'Jordan Recruiter',
    role: 'Recruiter',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.candidate.findUnique).mockResolvedValue(candidateRecord as any);
    vi.mocked(prisma.jobReq.findUnique).mockResolvedValue(jobReqRecord as any);
    vi.mocked(prisma.match.findFirst).mockResolvedValue(matchRecord as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(recruiterRecord as any);
    vi.mocked(prisma.outreachInteraction.create).mockResolvedValue({} as any);
  });

  it('snapshots the default templates and prompt version for coverage', () => {
    expect({ version: OAA_PROMPT_VERSION, templates: DEFAULT_OAA_TEMPLATES }).toMatchSnapshot();
  });

  it('renders email and SMS content from templates and match insight', async () => {
    const spec: AgentBehaviorSpec<
      Parameters<typeof runOutreachAutomation>[0],
      Awaited<ReturnType<typeof runOutreachAutomation>>
    > = {
      clauses: {
        given: 'a candidate with contact details and a matched job',
        when: 'OAA runs with defaults',
        then: 'email and SMS drafts are templated using match insights',
      },
      given: {
        recruiterId: 'user-1',
        candidateId: 'candidate-1',
        jobReqId: 'job-1',
      },
      when: (input) => runOutreachAutomation(input),
      snapshot: (result) => result,
      then: ({ result }) => {
        expect(result.agentRunId).toBe('agent-run-oaa');
        expect(result.email?.subject).toContain('Lead Backend Engineer');
        expect(result.email?.body).toContain('Sam Candidate');
        expect(result.sms?.body).toContain('Jordan Recruiter');
        expect(result.disposition).toBe('EMAIL_READY | SMS_READY');
        expect(prisma.outreachInteraction.create).toHaveBeenCalledTimes(2);
      },
    };

    await runAgentBehavior(spec);
  });

  it('suppresses channels based on opt-out settings while tracking disposition', async () => {
    vi.mocked(prisma.match.findFirst).mockResolvedValue({ ...matchRecord, explanation: null } as any);

    const result = await runOutreachAutomation({
      recruiterId: 'user-1',
      candidateId: 'candidate-1',
      jobReqId: 'job-1',
      optOut: { sms: true },
      templates: {
        sms: { body: 'Custom SMS for {{candidateName}}' },
      },
    });

    expect(result.sms).toBeNull();
    expect(result.email).not.toBeNull();
    expect(result.disposition).toBe('EMAIL_READY | SMS_SUPPRESSED');

    const interactionTypes = vi.mocked(prisma.outreachInteraction.create).mock.calls.map(
      (call) => call[0]?.data?.interactionType,
    );
    expect(interactionTypes).toContain('OAA_EMAIL_READY');
    expect(interactionTypes).toContain('OAA_SMS_SUPPRESSED');
  });
});
