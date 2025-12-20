import { NextRequest, NextResponse } from "next/server";

import { buildBenchmarkRelease, listBenchmarkReleases, type BenchmarkReleaseWithMetrics } from "@/lib/benchmarks/buildBenchmarkRelease";
import type { BenchmarkMetric } from "@/server/db/prisma";
import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

type BenchmarkMetricResponse = Omit<BenchmarkMetric, "createdAt"> & { createdAt: string };
type BenchmarkReleaseResponse = Omit<BenchmarkReleaseWithMetrics, "createdAt" | "publishedAt" | "metrics"> & {
  createdAt: string;
  publishedAt: string | null;
  metrics: BenchmarkMetricResponse[];
};

function serializeReleaseWithMetrics(release: BenchmarkReleaseWithMetrics): BenchmarkReleaseResponse {
  return {
    ...release,
    createdAt: release.createdAt.toISOString(),
    publishedAt: release.publishedAt ? release.publishedAt.toISOString() : null,
    metrics: release.metrics.map((metric) => ({
      ...metric,
      createdAt: metric.createdAt.toISOString(),
    })),
  };
}

function parseRequestBody(body: unknown) {
  if (typeof body !== "object" || body === null) return null;

  const version = typeof (body as any).version === "string" ? (body as any).version.trim() : null;
  const windowDays = Number((body as any).windowDays);
  const minimumSampleSize =
    typeof (body as any).minimumSampleSize === "number" ? (body as any).minimumSampleSize : undefined;

  if (!version || Number.isNaN(windowDays) || windowDays <= 0) {
    return null;
  }

  return { version, windowDays, minimumSampleSize };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const releases = await listBenchmarkReleases();
  const payload: BenchmarkReleaseResponse[] = releases.map(serializeReleaseWithMetrics);

  return NextResponse.json({ releases: payload });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: { version: string; windowDays: number; minimumSampleSize?: number } | null = null;

  try {
    payload = parseRequestBody(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload) {
    return NextResponse.json({ error: "version and windowDays are required" }, { status: 400 });
  }

  try {
    const release = await buildBenchmarkRelease(payload);
    return NextResponse.json({ release: serializeReleaseWithMetrics(release) });
  } catch (error) {
    console.error("Failed to build benchmark release", error);
    return NextResponse.json({ error: "Unable to build benchmark release" }, { status: 500 });
  }
}
