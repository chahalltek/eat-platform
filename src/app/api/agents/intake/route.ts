<<<<<<< ours
<<<<<<< ours
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
=======
import { NextResponse } from "next/server";
import { z } from "zod";

import type { IntakeSkill, JobIntakeProfile, JobIntakeRequest, JobIntakeResponse } from "@/types/intake";

const requestSchema = z.object({
  description: z.string().min(1, "description is required"),
  title: z.string().optional().nullable(),
  customer: z.string().optional().nullable(),
});

function normalizeTextList(items: string[]) {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    results.push(trimmed);
  }

  return results;
}

function extractSkills(description: string): IntakeSkill[] {
  const bulletPattern = /^[-*•]\s*(.+)$/;
  const lines = description.split(/\r?\n/).map((line) => line.trim());
  const skills: IntakeSkill[] = [];

  for (const line of lines) {
    if (!line) continue;

    const bulletMatch = line.match(bulletPattern);
    if (bulletMatch) {
      const skill = bulletMatch[1];
      skills.push({ name: skill });
      continue;
    }

    if (/experience|knowledge|familiar|background|expertise/i.test(line)) {
      skills.push({ name: line });
    }
  }

  return skills;
}

function extractMustHaves(description: string): string[] {
  const lines = description.split(/\r?\n/).map((line) => line.trim());
  const mustHaveTriggers = /(must[-\s]?have|required|required:|requirements:)/i;
  const collected: string[] = [];

  for (const line of lines) {
    if (!line) continue;

    if (mustHaveTriggers.test(line)) {
      collected.push(line.replace(mustHaveTriggers, "").trim() || line);
      continue;
    }

    if (/\b(years? of experience|proficiency|certification)\b/i.test(line)) {
      collected.push(line);
    }
  }

  return normalizeTextList(collected);
}

function extractAmbiguities(description: string): string[] {
  const lines = description.split(/\r?\n/).map((line) => line.trim());
  const ambiguities: string[] = [];

  for (const line of lines) {
    if (!line) continue;

    if (/[?]/.test(line)) {
      ambiguities.push(line);
      continue;
    }

    if (/\bor\b/i.test(line) && /\/|\(|\)/.test(line)) {
      ambiguities.push(line);
    }
  }

  return normalizeTextList(ambiguities);
}

function buildProfile(body: JobIntakeRequest): JobIntakeProfile {
  const description = body.description.trim();
  const skills = extractSkills(description);
  const mustHaves = extractMustHaves(description);
  const ambiguities = extractAmbiguities(description);

  const uniqueSkills = normalizeTextList(skills.map((skill) => skill.name)).map((name) => ({ name }));

  return {
    title: body.title?.trim() || null,
    customer: body.customer?.trim() || null,
    skills: uniqueSkills,
    mustHaves,
    ambiguities,
    rawDescription: description,
  } satisfies JobIntakeProfile;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const profile = buildProfile(parsed.data);

  const response: JobIntakeResponse = { profile };

  return NextResponse.json(response, { status: 200 });
>>>>>>> theirs
}
=======
export { POST } from '../rua/route';
>>>>>>> theirs
