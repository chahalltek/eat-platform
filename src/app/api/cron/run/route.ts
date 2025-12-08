import { NextResponse } from "next/server";

import { listCronJobs, runCronJob } from "@/lib/cron/runner";

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobName } = (body ?? {}) as { jobName?: string };

  if (!jobName) {
    return NextResponse.json(
      { error: "jobName is required", availableJobs: listCronJobs() },
      { status: 400 },
    );
  }

  try {
    const runResult = await runCronJob(jobName);
    return NextResponse.json(runResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
