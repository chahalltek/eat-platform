import { NextResponse } from "next/server";

import { computeMatchConfidence } from "@/lib/matching/confidence";
import { computeMatchScore } from "@/lib/matching/msa";
import type { Candidate, CandidateSkill, JobReq, JobSkill } from "@prisma/client";

type TestResult = {
  testKey: string;
  status: "pass" | "fail";
  details: string;
  durationMs: number;
  output?: unknown;
};

type TestRequest = {
  tenant?: string;
  pipeline?: boolean;
  scoring?: boolean;
  testKey?: string;
};

const REQUIRED_ENV_VARS = ["DATABASE_URL", "NODE_ENV", "APP_ENV"] as const;
const REQUIRED_CONFIG_FIELDS = [
  "INTAKE",
  "RUA",
  "MATCH",
  "CONFIDENCE",
  "EXPLAIN",
  "SAPIENT",
  "TEST",
] as const;

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

async function runTest(
  testKey: string,
  runner: () => Promise<Omit<TestResult, "testKey" | "status" | "durationMs"> | string>,
): Promise<TestResult> {
  const startedAt = Date.now();

  try {
    const details = await runner();
    const resolvedDetails = typeof details === "string" ? details : details.details ?? "ok";

    return {
      testKey,
      status: "pass",
      details: resolvedDetails,
      durationMs: Date.now() - startedAt,
      ...(typeof details === "string" ? {} : { output: details.output ?? undefined }),
    } satisfies TestResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      testKey,
      status: "fail",
      details: message,
      durationMs: Date.now() - startedAt,
    } satisfies TestResult;
  }
}

function verifyEnvAndConfig(tenant?: string) {
  const missingEnv = REQUIRED_ENV_VARS.filter((key) => !asString(process.env[key]));
  const missingConfig = REQUIRED_CONFIG_FIELDS.filter((field) => !asString(process.env[field]));

  if (missingEnv.length === 0 && missingConfig.length === 0) {
    const tenantLabel = tenant ? ` for tenant ${tenant}` : "";
    return `EAT pipeline configuration ready${tenantLabel}`;
  }

  const problems = [] as string[];

  if (missingEnv.length > 0) {
    problems.push(`Missing env vars: ${missingEnv.join(", ")}`);
  }

  if (missingConfig.length > 0) {
    problems.push(`Missing EAT config fields: ${missingConfig.join(", ")}`);
  }

  throw new Error(problems.join("; "));
}

function buildSampleCandidate(): Candidate & { skills: CandidateSkill[] } {
  const now = new Date();

  return {
    id: "sample-candidate",
    tenantId: "default-tenant",
    fullName: "Sample Candidate",
    email: "sample@example.com",
    phone: null,
    location: "Remote",
    currentTitle: "Software Engineer",
    currentCompany: "Example Corp",
    totalExperienceYears: 6,
    seniorityLevel: "mid",
    summary: "Seasoned engineer with backend focus",
    rawResumeText: "",
    sourceType: null,
    sourceTag: null,
    parsingConfidence: null,
    trustScore: null,
    status: "Active",
    normalizedSkills: ["typescript", "node.js", "aws", "postgres"],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    skills: [
      {
        id: "skill-1",
        tenantId: "default-tenant",
        candidateId: "sample-candidate",
        name: "TypeScript",
        normalizedName: "typescript",
        proficiency: "High",
        yearsOfExperience: 4,
      },
      {
        id: "skill-2",
        tenantId: "default-tenant",
        candidateId: "sample-candidate",
        name: "AWS",
        normalizedName: "aws",
        proficiency: "Medium",
        yearsOfExperience: 3,
      },
      {
        id: "skill-3",
        tenantId: "default-tenant",
        candidateId: "sample-candidate",
        name: "PostgreSQL",
        normalizedName: "postgres",
        proficiency: "Medium",
        yearsOfExperience: 3,
      },
    ],
  } satisfies Candidate & { skills: CandidateSkill[] };
}

function buildSampleJob(): JobReq & { skills: JobSkill[] } {
  const now = new Date();

  return {
    id: "sample-job",
    tenantId: "default-tenant",
    title: "Backend Engineer",
    location: "Remote",
    employmentType: "Full-time",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryInterval: null,
    seniorityLevel: "mid",
    rawDescription: "Build APIs and services",
    status: "Open",
    sourceType: null,
    sourceTag: null,
    customerId: null,
    createdAt: now,
    updatedAt: now,
    skills: [
      {
        id: "job-skill-1",
        tenantId: "default-tenant",
        jobReqId: "sample-job",
        name: "TypeScript",
        normalizedName: "typescript",
        required: true,
        weight: 2,
      },
      {
        id: "job-skill-2",
        tenantId: "default-tenant",
        jobReqId: "sample-job",
        name: "AWS",
        normalizedName: "aws",
        required: false,
        weight: 1,
      },
      {
        id: "job-skill-3",
        tenantId: "default-tenant",
        jobReqId: "sample-job",
        name: "GraphQL",
        normalizedName: "graphql",
        required: false,
        weight: 1,
      },
    ],
    matches: [],
    matchResults: [],
    jobCandidates: [],
    outreachInteractions: [],
  } satisfies JobReq & { skills: JobSkill[] };
}

async function runPipelineTest(tenant?: string) {
  return verifyEnvAndConfig(tenant);
}

async function runScoringTest() {
  const candidate = buildSampleCandidate();
  const jobReq = buildSampleJob();

  const matchScore = computeMatchScore({ candidate, jobReq });
  const confidence = computeMatchConfidence({ candidate, jobReq });

  return {
    details: `Computed match score ${matchScore.score} with confidence ${confidence.score}`,
    output: {
      matchScore,
      confidence,
    },
  } as const;
}

function resolveTestKeys(request: TestRequest): string[] {
  const keys = new Set<string>();

  if (request.testKey) {
    keys.add(request.testKey);
  }

  if (request.pipeline) {
    keys.add("pipeline");
  }

  if (request.scoring) {
    keys.add("scoring");
  }

  if (keys.size === 0) {
    keys.add("pipeline");
    keys.add("scoring");
  }

  return Array.from(keys);
}

export async function POST(req: Request) {
  let body: TestRequest;

  try {
    body = ((await req.json()) ?? {}) as TestRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const testsToRun = resolveTestKeys(body);

  const results: TestResult[] = [];

  for (const key of testsToRun) {
    if (key === "pipeline") {
      results.push(await runTest("pipeline", () => runPipelineTest(body.tenant)));
      continue;
    }

    if (key === "scoring") {
      results.push(await runTest("scoring", runScoringTest));
      continue;
    }

    results.push({
      testKey: key,
      status: "fail",
      details: `Unknown testKey: ${key}`,
      durationMs: 0,
    });
  }

  return NextResponse.json(results);
}
