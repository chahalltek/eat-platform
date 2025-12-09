import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { callLLM } from '@/lib/llm';
import { prisma } from '@/lib/prisma';
import { canViewCandidates } from '@/lib/auth/permissions';
import { getCurrentUser } from '@/lib/auth/user';
import { getCurrentTenantId } from '@/lib/tenant';
import { normalizeError } from '@/lib/errors';

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
  const currentUser = await getCurrentUser(req);

  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { jobReqId, rawDescription, tenantId } =
    (body as { jobReqId?: unknown; rawDescription?: unknown; tenantId?: unknown }) ?? {};

  const trimmedDescription = trimString(rawDescription);

  if (!trimmedDescription) {
    return NextResponse.json({ error: 'rawDescription is required' }, { status: 400 });
  }

  const resolvedTenantId = trimString(tenantId) || (await getCurrentTenantId(req));

  if (!canViewCandidates(currentUser, resolvedTenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const agentName = 'EAT-TS.INTAKE';
  const startedAt = new Date();
  const inputSnapshot = {
    jobReqId: trimString(jobReqId) || null,
    rawDescription: trimmedDescription.slice(0, 4000),
    tenantId: resolvedTenantId ?? null,
  } as const;

  const agentRun = await prisma.agentRunLog.create({
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
    });

    let parsedProfile: JobIntakeProfile;

    try {
      const parsed = JSON.parse(llmRaw);
      parsedProfile = intakeProfileSchema.parse(parsed);
    } catch (error) {
      throw new Error('Failed to parse LLM output');
    }

    await prisma.$transaction(async (tx) => {
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

        return;
      }

      await tx.jobReq.create({
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
    });

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    await prisma.agentRunLog.update({
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

    await prisma.agentRunLog.update({
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
}
