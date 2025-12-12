import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { callLLM } from '@/lib/llm';
import { requireRole } from '@/lib/auth/requireRole';
import { USER_ROLES } from '@/lib/auth/roles';
import { AGENT_KILL_SWITCHES, enforceAgentKillSwitch } from '@/lib/agents/killSwitch';
import { normalizeError } from '@/lib/errors';
import { getTenantScopedPrismaClient, toTenantErrorResponse } from '@/lib/agents/tenantScope';
import { getCurrentTenantId } from '@/lib/tenant';
import { onJobChanged } from '@/lib/orchestration/triggers';
import { recordMetricEvent } from '@/lib/metrics/events';

const jobSkillSchema = z.object({
  name: z.string().min(1),
  normalizedName: z.string().min(1).optional(),
  required: z.boolean().optional(),
});

const intakeProfileSchema = z.object({
  title: z.string().min(1),
  location: z.string().nullable().optional(),
  employmentType: z.string().nullable().optional(),
  seniorityLevel: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  skills: z.array(jobSkillSchema).default([]),
});

export type JobIntakeProfile = z.infer<typeof intakeProfileSchema>;

function buildSystemPrompt() {
  return `You are an INTAKE agent that converts unstructured job descriptions into a normalized profile.
Return a valid JSON object that matches this TypeScript type:
{
  "title": string;
  "location"?: string | null;
  "employmentType"?: string | null;
  "seniorityLevel"?: string | null;
  "status"?: string | null;
  "skills": Array<{ name: string; normalizedName?: string; required?: boolean }>;
}
- Use concise titles.
- Include 5-12 key skills with normalizedName values when possible.
- required should be true for must-have skills.
- Always reply with JSON only.`;
}

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: NextRequest) {
  const roleCheck = await requireRole(req, [USER_ROLES.ADMIN, USER_ROLES.RECRUITER]);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  let scopedTenant;
  try {
    scopedTenant = await getTenantScopedPrismaClient(req);
  } catch (error) {
    const tenantError = toTenantErrorResponse(error);

    if (tenantError) {
      return tenantError;
    }

    throw error;
  }

  const currentUser = roleCheck.user;

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { jobReqId, rawDescription, rawJobText } =
    (body as {
      jobReqId?: unknown;
      rawDescription?: unknown;
      rawJobText?: unknown;
    }) ?? {};

  const trimmedDescription = trimString(rawDescription ?? rawJobText);

  if (!trimmedDescription) {
    return NextResponse.json({ error: 'rawDescription is required' }, { status: 400 });
  }

  const tenantId = await getCurrentTenantId(req);
  const killSwitchResponse = await enforceAgentKillSwitch(AGENT_KILL_SWITCHES.INTAKE, tenantId);

  if (killSwitchResponse) {
    return killSwitchResponse;
  }

  const { prisma: scopedPrisma, tenantId: resolvedTenantId, runWithTenantContext } = scopedTenant;

  const agentName = AGENT_KILL_SWITCHES.INTAKE;
  const startedAt = new Date();
  const inputSnapshot = {
    jobReqId: trimString(jobReqId) || null,
    rawDescription: trimmedDescription.slice(0, 4000),
    tenantId: resolvedTenantId ?? null,
  } as const;

  return runWithTenantContext(async () => {
    const agentRun = await scopedPrisma.agentRunLog.create({
      data: {
        agentName,
        userId: currentUser.id,
        tenantId: resolvedTenantId ?? null,
        input: inputSnapshot,
        inputSnapshot,
        status: 'RUNNING',
        startedAt,
      },
    });

    try {
      const llmRaw = await callLLM({
        systemPrompt: buildSystemPrompt(),
        userPrompt: `Job Description:\n"""${trimmedDescription}"""`,
        agent: 'INTAKE',
      });

      let parsedProfile: JobIntakeProfile;

      try {
        const parsed = JSON.parse(llmRaw);
        parsedProfile = intakeProfileSchema.parse(parsed);
      } catch (error) {
        throw new Error('Failed to parse LLM output');
      }

      const runTransaction = scopedPrisma.$transaction
        ? scopedPrisma.$transaction.bind(scopedPrisma)
        : async (fn: (tx: typeof scopedPrisma) => Promise<void>) =>
            fn(scopedPrisma as unknown as typeof scopedPrisma);

      let jobReqId: string | null = null;

      await runTransaction(async (tx) => {
        const skillCreates = parsedProfile.skills.map((skill) => ({
          name: skill.name,
          normalizedName: skill.normalizedName || skill.name,
          required: skill.required ?? false,
          tenantId: resolvedTenantId,
        }));

        if (inputSnapshot.jobReqId) {
          const existing = await tx.jobReq.findUnique({
            where: { id: inputSnapshot.jobReqId, tenantId: resolvedTenantId },
            select: { id: true },
          });

          if (!existing) {
            throw new Error('JobReq not found');
          }

          await tx.jobSkill.deleteMany({
            where: { jobReqId: existing.id, tenantId: resolvedTenantId },
          });
          await tx.jobReq.update({
            where: { id: existing.id },
            data: {
              title: parsedProfile.title,
              location: parsedProfile.location ?? null,
              employmentType: parsedProfile.employmentType ?? null,
              seniorityLevel: parsedProfile.seniorityLevel ?? null,
              status: parsedProfile.status ?? null,
              rawDescription: trimmedDescription,
              tenantId: resolvedTenantId,
              skills: { create: skillCreates },
            },
          });

          jobReqId = existing.id;

          return;
        }

        const createdJob = await tx.jobReq.create({
          data: {
            tenantId: resolvedTenantId,
            title: parsedProfile.title,
            location: parsedProfile.location ?? null,
            employmentType: parsedProfile.employmentType ?? null,
            seniorityLevel: parsedProfile.seniorityLevel ?? null,
            status: parsedProfile.status ?? null,
            rawDescription: trimmedDescription,
            skills: { create: skillCreates },
          },
        });

        jobReqId = createdJob.id;
      });

      if (jobReqId && resolvedTenantId) {
        void onJobChanged({ tenantId: resolvedTenantId, jobId: jobReqId });
      }

      const tenantForMetrics = resolvedTenantId ?? 'default-tenant';
      void recordMetricEvent({
        tenantId: tenantForMetrics,
        eventType: inputSnapshot.jobReqId ? 'JOB_UPDATED' : 'JOB_CREATED',
        entityId: jobReqId ?? undefined,
        meta: {
          status: parsedProfile.status ?? null,
          skillsCount: parsedProfile.skills.length,
          sourceType: 'agent_intake',
        },
      });

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      await scopedPrisma.agentRunLog.update({
        where: { id: agentRun.id },
        data: {
          output: { snapshot: parsedProfile, durationMs },
          outputSnapshot: parsedProfile,
          durationMs,
          status: 'SUCCESS',
          finishedAt,
        },
      });

      return NextResponse.json(parsedProfile, { status: 200 });
    } catch (err) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      const { userMessage, category } = normalizeError(err);

      await scopedPrisma.agentRunLog.update({
        where: { id: agentRun.id },
        data: {
          output: { durationMs, errorCategory: category },
          durationMs,
          status: 'FAILED',
          errorMessage: userMessage,
          finishedAt,
        },
      });

      const status = userMessage === 'JobReq not found' ? 404 : 500;

      return NextResponse.json({ error: userMessage }, { status });
    }
  });
}

