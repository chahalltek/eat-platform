import { AgentRetryMetadata, withAgentRun } from '@/lib/agents/agentRun';
import { prisma } from '@/server/db/prisma';
import { getCurrentTenantId } from '@/lib/tenant';

export const OAA_PROMPT_VERSION = 'v1.1.0';

export type OutreachAutomationTemplates = {
  email: { subject: string; body: string };
  sms: { body: string };
};

export type OutreachAutomationInput = {
  recruiterId?: string;
  candidateId: string;
  jobReqId: string;
  matchId?: string;
  templates?: Partial<OutreachAutomationTemplates>;
  optOut?: { email?: boolean; sms?: boolean };
  tone?: 'casual' | 'formal' | 'enthusiastic' | 'concise';
};

export type OutreachAutomationResult = {
  email: { subject: string; body: string } | null;
  sms: { body: string } | null;
  disposition: string;
  agentRunId: string;
};

export const DEFAULT_OAA_TEMPLATES: OutreachAutomationTemplates = {
  email: {
    subject: 'Opportunity: {{roleTitle}} @ {{companyName}}',
    body: `Hi {{candidateName}},\n\nI’m {{recruiterName}} from Strategic Systems. I reviewed your background and believe you’d be a strong fit for our {{roleTitle}} role with {{companyName}}. {{matchReason}}\n\nIf you’re interested, {{nextStep}}\n\n{{optOutLine}}`,
  },
  sms: {
    body: `Hi {{candidateName}}, this is {{recruiterName}} with Strategic Systems about a {{roleTitle}} role at {{companyName}}. {{matchReason}} {{nextStep}} {{optOutLine}}`,
  },
};

function resolveTemplates(customTemplates?: Partial<OutreachAutomationTemplates>): OutreachAutomationTemplates {
  return {
    email: {
      subject: customTemplates?.email?.subject ?? DEFAULT_OAA_TEMPLATES.email.subject,
      body: customTemplates?.email?.body ?? DEFAULT_OAA_TEMPLATES.email.body,
    },
    sms: {
      body: customTemplates?.sms?.body ?? DEFAULT_OAA_TEMPLATES.sms.body,
    },
  };
}

function renderTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_match, key) => context[key] ?? '');
}

function assertResolvedTemplate(output: string, channel: 'email' | 'sms', field: 'subject' | 'body') {
  if (/{{\s*\w+\s*}}/.test(output)) {
    throw new Error(`Unresolved placeholder detected in ${channel} ${field}`);
  }
}

function buildOptOutLine(optOut?: { email?: boolean; sms?: boolean }): string {
  if (optOut?.email && optOut?.sms) {
    return 'You are opted out of outreach for now—feel free to reply when ready.';
  }

  return 'If you prefer not to receive updates, reply STOP or let me know.';
}

function summarizeDisposition(emailSuppressed: boolean, smsSuppressed: boolean): string {
  const states = [
    emailSuppressed ? 'EMAIL_SUPPRESSED' : 'EMAIL_READY',
    smsSuppressed ? 'SMS_SUPPRESSED' : 'SMS_READY',
  ];

  return states.join(' | ');
}

async function buildTemplateContext({
  candidateId,
  jobReqId,
  recruiterId,
  matchId,
}: {
  candidateId: string;
  jobReqId: string;
  recruiterId?: string;
  matchId?: string;
}) {
  const tenantId = await getCurrentTenantId();

  const [candidate, jobReq, match, recruiter] = await Promise.all([
    prisma.candidate.findUnique({
      where: { id: candidateId, tenantId },
      include: { skills: true },
    }),
    prisma.jobReq.findUnique({
      where: { id: jobReqId, tenantId },
      include: { customer: true, skills: true },
    }),
    prisma.match.findFirst({
      where: matchId
        ? { id: matchId, tenantId }
        : { candidateId, jobReqId, tenantId },
      orderBy: { createdAt: 'desc' },
    }),
    recruiterId
      ? prisma.user.findUnique({ where: { id: recruiterId, tenantId } })
      : Promise.resolve(null),
  ]);

  if (!candidate) {
    throw new Error('Candidate not found');
  }

  if (!jobReq) {
    throw new Error('JobReq not found');
  }

  const topSkill = candidate.skills?.[0]?.normalizedName || candidate.skills?.[0]?.name;
  const jobSkill = jobReq.skills?.find((skill) => skill.required)?.normalizedName ?? jobReq.skills?.[0]?.normalizedName;

  const matchReason =
    match?.explanation ||
    (topSkill && jobSkill
      ? `your experience with ${topSkill} pairs nicely with the ${jobSkill} focus for this team.`
      : 'your background lines up with what this team needs.');

  const recruiterName = recruiter?.displayName || 'our recruiting team';

  return {
    candidate,
    jobReq,
    recruiterName,
    matchReason,
  };
}

function resolveToneSettings(tone?: 'casual' | 'formal' | 'enthusiastic' | 'concise') {
  switch (tone) {
    case 'formal':
      return {
        nextStep: 'would you be available for a brief introductory call this week?',
        toneTagline: 'Thank you for your consideration.',
      };
    case 'enthusiastic':
      return {
        nextStep: "I'd love to set up a quick 15-minute call to share why this team is excited about your background!",
        toneTagline: 'Looking forward to collaborating.',
      };
    case 'concise':
      return {
        nextStep: 'can we schedule a quick 10-minute chat to confirm mutual fit?',
        toneTagline: 'Keeping this brief—happy to share more details live.',
      };
    case 'casual':
    default:
      return {
        nextStep: 'could we schedule a quick 15-minute intro call this week?',
        toneTagline: 'Happy to share more details or answer questions.',
      };
  }
}

async function persistDispositionEntries({
  candidateId,
  jobReqId,
  agentRunId,
  emailSuppressed,
  smsSuppressed,
}: {
  candidateId: string;
  jobReqId: string;
  agentRunId: string;
  emailSuppressed: boolean;
  smsSuppressed: boolean;
}) {
  const interactions = [
    emailSuppressed ? 'OAA_EMAIL_SUPPRESSED' : 'OAA_EMAIL_READY',
    smsSuppressed ? 'OAA_SMS_SUPPRESSED' : 'OAA_SMS_READY',
  ];

  await Promise.all(
    interactions.map((interactionType) =>
      prisma.outreachInteraction.create({
        data: {
          candidateId,
          jobReqId,
          agentRunId,
          interactionType,
        },
      }),
    ),
  );
}

export async function runOutreachAutomation(
  input: OutreachAutomationInput,
  retryMetadata?: AgentRetryMetadata,
): Promise<OutreachAutomationResult> {
  const { recruiterId, candidateId, jobReqId, matchId } = input;

  const [result, agentRunId] = await withAgentRun<{
    email: { subject: string; body: string } | null;
    sms: { body: string } | null;
    disposition: string;
  }>(
    {
      agentName: 'ETE-TS.OUTREACH_AUTOMATION',
      recruiterId,
      inputSnapshot: { recruiterId: recruiterId ?? null, candidateId, jobReqId, matchId },
      ...retryMetadata,
    },
    async () => {
      const { candidate, jobReq, recruiterName, matchReason } = await buildTemplateContext({
        candidateId,
        jobReqId,
        recruiterId,
        matchId,
      });

      const templates = resolveTemplates(input.templates);
      const emailSuppressed = input.optOut?.email === true || !candidate.email;
      const smsSuppressed = input.optOut?.sms === true || !candidate.phone;

      const { nextStep, toneTagline } = resolveToneSettings(input.tone);

      const context = {
        candidateName: candidate.fullName,
        roleTitle: jobReq.title,
        companyName: jobReq.customer?.name ?? 'our client',
        recruiterName,
        matchReason,
        nextStep,
        toneTagline,
        optOutLine: buildOptOutLine(input.optOut),
      } satisfies Record<string, string>;

      const email = emailSuppressed
        ? null
        : {
            subject: renderTemplate(templates.email.subject, context),
            body: renderTemplate(templates.email.body, context),
          };

      const sms = smsSuppressed
        ? null
        : {
            body: renderTemplate(templates.sms.body, context),
          };

      if (email) {
        assertResolvedTemplate(email.subject, 'email', 'subject');
        assertResolvedTemplate(email.body, 'email', 'body');
      }

      if (sms) {
        assertResolvedTemplate(sms.body, 'sms', 'body');
      }

      const disposition = summarizeDisposition(emailSuppressed, smsSuppressed);

      return {
        result: { email, sms, disposition },
        outputSnapshot: {
          candidateId,
          jobReqId,
          matchId: matchId ?? null,
          disposition,
          email,
          sms,
          templateVersion: OAA_PROMPT_VERSION,
        },
      };
    },
  );

  try {
    const emailSuppressed = result.email === null;
    const smsSuppressed = result.sms === null;
    await persistDispositionEntries({
      candidateId,
      jobReqId,
      agentRunId,
      emailSuppressed,
      smsSuppressed,
    });
  } catch (err) {
    console.error('Failed to persist outreach automation disposition', err);
  }

  return { ...result, agentRunId };
}

export const renderOaaTemplate = renderTemplate;
