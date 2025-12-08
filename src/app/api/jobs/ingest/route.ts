import { NextResponse } from "next/server";

import { z } from "zod";

import { ingestJob } from "@/lib/matching/matcher";
import { getCurrentTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

const jobSkillSchema = z.object({
  name: z.string().min(1, "Skill name is required"),
  required: z.boolean().optional(),
  weight: z.number().nonnegative().optional(),
});

const jobSchema = z.object({
  title: z
    .string({ required_error: "title is required", invalid_type_error: "title is required" })
    .min(1, "title is required"),
  location: z.string().nullable().optional(),
  seniorityLevel: z.string().nullable().optional(),
  rawDescription: z.string().nullable().optional(),
  sourceType: z.string().nullable().optional(),
  sourceTag: z.string().nullable().optional(),
  skills: z.array(jobSkillSchema).default([]),
});

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = jobSchema.safeParse(body);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => (issue.path[0] === "title" ? "title is required" : issue.message))
      .join("; ");
    return NextResponse.json({ error: issues }, { status: 400 });
  }

  const tenantId = await getCurrentTenantId();

  const jobReq = await ingestJob({ ...parsed.data }, prisma);

  if (tenantId && jobReq.tenantId !== tenantId) {
    await prisma.jobReq.update({ where: { id: jobReq.id }, data: { tenantId } });
    jobReq.tenantId = tenantId;
  }

  return NextResponse.json(jobReq, { status: 201 });
}

