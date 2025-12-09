import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { getCurrentUser, getUserTenantId } from "@/lib/auth/user";
import { normalizeRole, USER_ROLES, type UserRole } from "@/lib/auth/roles";
import { candidateProfileSchema, candidateSkillSchema } from "@/types/candidateIntake";

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
});

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

    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    console.error("Failed to save candidate", error);
    return NextResponse.json({ error: "Unable to save candidate" }, { status: 500 });
  }
}
