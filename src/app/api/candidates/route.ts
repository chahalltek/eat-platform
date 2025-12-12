import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { getCurrentUser, getUserTenantId } from "@/lib/auth/user";
import { normalizeRole, USER_ROLES, type UserRole } from "@/lib/auth/roles";
import { candidateProfileSchema, candidateSkillSchema } from "@/types/candidateIntake";
import { onCandidateChanged } from "@/lib/orchestration/triggers";

const recruiterRoles = new Set<UserRole>([
  USER_ROLES.ADMIN,
  USER_ROLES.SYSTEM_ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.RECRUITER,
  USER_ROLES.SOURCER,
]);

const requestSchema = z.object({
  profile: candidateProfileSchema,
  tenantId: z.string().trim().optional(),
  skills: z.array(candidateSkillSchema).optional(),
  jobReqId: z.string().trim().optional(),
});

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser(req);

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const normalizedRole = normalizeRole(currentUser.role);

  if (!normalizedRole || !recruiterRoles.has(normalizedRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = (await getUserTenantId(req)) ?? DEFAULT_TENANT_ID;

  try {
    const candidates = await prisma.candidate.findMany({
      where: { tenantId },
      include: {
        skills: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    const rows = candidates.map((candidate) => ({
      id: candidate.id,
      fullName: candidate.fullName,
      currentTitle: candidate.currentTitle,
      location: candidate.location,
      status: candidate.status,
      parsingConfidence: candidate.parsingConfidence,
      updatedAt: candidate.updatedAt.toISOString(),
    }));

    return NextResponse.json({ candidates: rows }, { status: 200 });
  } catch (error) {
    console.error("[Candidates API] Failed to fetch candidates", error);
    return NextResponse.json({ error: "Unable to load candidates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser(req);

  if (!currentUser) {
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

  const tenantId = (parsedBody.tenantId || (await getUserTenantId(req)) || DEFAULT_TENANT_ID).trim();
  const { profile } = parsedBody;
  const jobReqId = parsedBody.jobReqId?.trim();

  const jobReq = jobReqId
    ? await prisma.jobReq.findUnique({ where: { id: jobReqId, tenantId }, select: { id: true, tenantId: true } })
    : null;

  try {
    const candidate = await prisma.candidate.create({
      data: {
        tenantId,
        fullName: profile.fullName,
        email: null,
        phone: null,
        location: profile.location ?? null,
        currentTitle: profile.currentTitle ?? null,
        currentCompany: null,
        totalExperienceYears: profile.totalExperienceYears ?? null,
        seniorityLevel: profile.seniorityLevel ?? null,
        summary: profile.summary ?? null,
        rawResumeText: profile.rawResumeText ?? null,
        parsingConfidence: profile.parsingConfidence ?? null,
        skills: {
          create: (parsedBody.skills ?? profile.skills).map((skill) => ({
            tenantId,
            name: skill.name,
            normalizedName: skill.normalizedName || skill.name,
            proficiency: skill.proficiency ?? null,
            yearsOfExperience: skill.yearsOfExperience ?? null,
          })),
        },
      },
    });

    if (jobReq) {
      void onCandidateChanged({ tenantId: jobReq.tenantId, jobId: jobReq.id, candidateIds: [candidate.id] });
    }

    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    console.error("Failed to save candidate", error);
    return NextResponse.json({ error: "Unable to save candidate" }, { status: 500 });
  }
}
