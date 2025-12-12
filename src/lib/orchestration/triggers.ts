import { runPipeline } from "@/lib/orchestration/pipelineRunner";

type PipelineTriggerInput = {
  tenantId: string;
  jobId: string;
  candidateIds?: string[];
};

const JOB_DEBOUNCE_MS = 30_000;
const recentJobTriggers = new Map<string, number>();

async function runMatchPipeline(input: PipelineTriggerInput) {
  try {
    await runPipeline({
      tenantId: input.tenantId,
      jobId: input.jobId,
      candidateIds: input.candidateIds,
      steps: ["MATCH", "CONFIDENCE"],
      mode: "auto",
    });
  } catch (error) {
    console.error("Failed to run pipeline trigger", {
      jobId: input.jobId,
      tenantId: input.tenantId,
      candidateIds: input.candidateIds,
      error,
    });
  }
}

export async function onJobChanged(input: PipelineTriggerInput) {
  const cacheKey = `${input.tenantId}:${input.jobId}`;
  const now = Date.now();
  const lastTriggeredAt = recentJobTriggers.get(cacheKey) ?? 0;

  if (now - lastTriggeredAt < JOB_DEBOUNCE_MS) {
    return;
  }

  recentJobTriggers.set(cacheKey, now);
  await runMatchPipeline(input);
}

export async function onCandidateChanged(input: PipelineTriggerInput) {
  await runMatchPipeline(input);
}
