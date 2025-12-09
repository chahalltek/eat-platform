<<<<<<< ours
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { callLLM } from '@/lib/llm';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/user';
import { getCurrentTenantId } from '@/lib/tenant';
import { normalizeError } from '@/lib/errors';

const candidateSkillSchema = z.object({
  name: z.string().min(1),
  normalizedName: z.string().min(1).optional(),
  proficiency: z.string().nullable().optional(),
  yearsOfExperience: z.number().nullable().optional(),
});

const candidateProfileSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  currentTitle: z.string().nullable().optional(),
  currentCompany: z.string().nullable().optional(),
  totalExperienceYears: z.number().nullable().optional(),
  seniorityLevel: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  skills: z.array(candidateSkillSchema).default([]),
  parsingConfidence: z.number().min(0).max(1).nullable().optional(),
});

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;

function buildSystemPrompt() {
  return `You are a PROFILE agent that extracts structured candidate profiles from raw resumes.
Return a valid JSON object matching this TypeScript type:
{
  "fullName": string;
  "email"?: string | null;
  "phone"?: string | null;
  "location"?: string | null;
  "currentTitle"?: string | null;
  "currentCompany"?: string | null;
  "totalExperienceYears"?: number | null;
  "seniorityLevel"?: string | null;
  "summary"?: string | null;
  "skills": Array<{ name: string; normalizedName?: string; proficiency?: string | null; yearsOfExperience?: number | null }>;
  "parsingConfidence"?: number | null;
}
- Output JSON only.
- Keep names and titles concise.
- Provide 5-12 key skills with normalizedName when possible.
- parsingConfidence should be between 0 and 1 when provided.`;
}

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
=======
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { callLLM } from "@/lib/llm";
import { getCurrentUser } from "@/lib/auth/user";
import { normalizeRole, USER_ROLES, type UserRole } from "@/lib/auth/roles";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { candidateProfileSchema } from "@/types/candidateIntake";

const recruiterRoles = new Set<UserRole>([
  USER_ROLES.ADMIN,
  USER_ROLES.SYSTEM_ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.RECRUITER,
  USER_ROLES.SOURCER,
]);

const requestSchema = z.object({
  rawResumeText: z.string().min(1, "rawResumeText is required"),
  tenantId: z.string().trim().optional(),
});

function buildProfilePrompt() {
  return `You are a recruiter intake agent that converts a raw resume into a structured profile.
Return JSON matching this TypeScript type:
{
  fullName: string;
  currentTitle?: string | null;
  location?: string | null;
  seniorityLevel?: string | null;
  totalExperienceYears?: number | null;
  summary?: string | null;
  parsingConfidence?: number | null; // 0-1 where 1 is highest confidence
  skills: Array<{ name: string; normalizedName?: string; proficiency?: string; yearsOfExperience?: number | null }>;
}
- Keep responses concise and avoid extra commentary.
- Estimate seniority and totalExperienceYears when possible.
- Include at least 5 relevant skills when present.
- Always reply with JSON only.`;
>>>>>>> theirs
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser(req);

  if (!currentUser) {
<<<<<<< ours
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { candidateId, rawResumeText, fileId } =
    (body as { candidateId?: unknown; rawResumeText?: unknown; fileId?: unknown }) ?? {};

  const trimmedResume = trimString(rawResumeText);

  if (!trimmedResume) {
    return NextResponse.json({ error: 'rawResumeText is required' }, { status: 400 });
  }

  const tenantId = await getCurrentTenantId(req);

  const agentName = 'EAT-TS.PROFILE';
  const startedAt = new Date();
  const inputSnapshot = {
    candidateId: trimString(candidateId) || null,
    rawResumeText: trimmedResume.slice(0, 4000),
    fileId: trimString(fileId) || null,
    tenantId,
  } as const;

  const agentRun = await prisma.agentRunLog.create({
    data: {
      agentName,
      userId: currentUser.id,
      tenantId,
      input: inputSnapshot,
      inputSnapshot,
      status: 'RUNNING',
      startedAt,
    },
  });

  try {
    const llmRaw = await callLLM({
      systemPrompt: buildSystemPrompt(),
      userPrompt: `Resume:\n"""${trimmedResume}"""`,
    });

    let parsedProfile: CandidateProfile;

    try {
      parsedProfile = candidateProfileSchema.parse(JSON.parse(llmRaw));
    } catch (error) {
      throw new Error('Failed to parse LLM output');
    }

    const normalizedSkills = parsedProfile.skills.map((skill) => ({
      name: skill.name,
      normalizedName: skill.normalizedName || skill.name,
      proficiency: skill.proficiency ?? null,
      yearsOfExperience: skill.yearsOfExperience ?? null,
      tenantId,
    }));

    const resolvedCandidateId = trimString(candidateId);

    const runTransaction = prisma.$transaction
      ? prisma.$transaction.bind(prisma)
      : async (fn: (tx: typeof prisma) => Promise<void>) => fn(prisma as unknown as typeof prisma);

    await runTransaction(async (tx) => {
      if (resolvedCandidateId) {
        const existing = await tx.candidate.findFirst({
          where: { id: resolvedCandidateId, tenantId },
          select: { id: true },
        });

        if (!existing) {
          throw new Error('Candidate not found');
        }

        await tx.candidateSkill.deleteMany({
          where: { candidateId: resolvedCandidateId, tenantId },
        });

        await tx.candidate.update({
          where: { id: resolvedCandidateId },
          data: {
            fullName: parsedProfile.fullName,
            email: parsedProfile.email ?? null,
            phone: parsedProfile.phone ?? null,
            location: parsedProfile.location ?? null,
            currentTitle: parsedProfile.currentTitle ?? null,
            currentCompany: parsedProfile.currentCompany ?? null,
            totalExperienceYears: parsedProfile.totalExperienceYears ?? null,
            seniorityLevel: parsedProfile.seniorityLevel ?? null,
            summary: parsedProfile.summary ?? null,
            rawResumeText: trimmedResume,
            parsingConfidence: parsedProfile.parsingConfidence ?? null,
            normalizedSkills: normalizedSkills.map((skill) => skill.normalizedName),
            skills: { create: normalizedSkills.map((skill) => ({
              name: skill.name,
              normalizedName: skill.normalizedName,
              proficiency: skill.proficiency,
              yearsOfExperience: skill.yearsOfExperience,
              tenantId,
            })) },
          },
        });

        return;
      }

      await tx.candidate.create({
        data: {
          tenantId,
          fullName: parsedProfile.fullName,
          email: parsedProfile.email ?? null,
          phone: parsedProfile.phone ?? null,
          location: parsedProfile.location ?? null,
          currentTitle: parsedProfile.currentTitle ?? null,
          currentCompany: parsedProfile.currentCompany ?? null,
          totalExperienceYears: parsedProfile.totalExperienceYears ?? null,
          seniorityLevel: parsedProfile.seniorityLevel ?? null,
          summary: parsedProfile.summary ?? null,
          rawResumeText: trimmedResume,
          parsingConfidence: parsedProfile.parsingConfidence ?? null,
          normalizedSkills: normalizedSkills.map((skill) => skill.normalizedName),
          skills: {
            create: normalizedSkills.map((skill) => ({
              name: skill.name,
              normalizedName: skill.normalizedName,
              proficiency: skill.proficiency,
              yearsOfExperience: skill.yearsOfExperience,
              tenantId,
            })),
          },
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

    const status = userMessage === 'Candidate not found' ? 404 : 500;

    return NextResponse.json({ error: userMessage }, { status });
=======
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const normalizedRole = normalizeRole(currentUser.role);

  if (!normalizedRole || !recruiterRoles.has(normalizedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let parsedBody: z.infer<typeof requestSchema>;

  try {
    parsedBody = requestSchema.parse(await req.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { rawResumeText, tenantId } = parsedBody;
  const resolvedTenantId = (tenantId ?? currentUser.tenantId ?? DEFAULT_TENANT_ID).trim();

  try {
    const llmRaw = await callLLM({
      systemPrompt: buildProfilePrompt(),
      userPrompt: `Resume:\n"""${rawResumeText.trim()}"""`,
    });

    const parsedJson = JSON.parse(llmRaw);
    const profile = candidateProfileSchema.parse({
      ...parsedJson,
      rawResumeText,
    });

    return NextResponse.json({ profile, tenantId: resolvedTenantId });
  } catch (error) {
    console.error("Failed to generate candidate profile", error);
    return NextResponse.json({ error: "Unable to generate profile" }, { status: 500 });
>>>>>>> theirs
  }
}
