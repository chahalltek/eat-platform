import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { runPipeline } from "@/lib/orchestration/pipelineRunner";
import {
  getTenantPolicies,
  selectApplicablePolicies,
  type OrchestrationPolicy,
} from "@/lib/orchestration/policies";
import { evaluateNextBestActionTriggers } from "@/lib/orchestration/nextBestAction";

type PipelineTriggerInput = {
  tenantId: string;
  jobId: string;
  candidateIds?: string[];
};

const JOB_DEBOUNCE_MS = 30_000;
const recentJobTriggers = new Map<string, number>();

async function runPolicyDrivenPipeline(event: OrchestrationPolicy["when"], input: PipelineTriggerInput) {
  const tenantMode = await loadTenantMode(input.tenantId);
  const candidateCount = input.candidateIds?.length ?? 0;
  const policies = selectApplicablePolicies(getTenantPolicies(input.tenantId), {
    event,
    tenantMode: tenantMode.mode,
    candidateCount,
  });

  if (policies.length === 0) {
    return;
  }

  for (const policy of policies) {
    try {
      await runPipeline({
        tenantId: input.tenantId,
        jobId: input.jobId,
        candidateIds: input.candidateIds,
        steps: policy.steps,
        mode: "auto",
      });
    } catch (error) {
      console.error("Failed to run pipeline trigger", {
        jobId: input.jobId,
        tenantId: input.tenantId,
        candidateIds: input.candidateIds,
        event,
        policy,
        error,
      });
    }
  }

  await evaluateNextBestActionTriggers({ jobId: input.jobId, tenantId: input.tenantId });
}

export async function onJobChanged(input: PipelineTriggerInput) {
  const cacheKey = `${input.tenantId}:${input.jobId}`;
  const now = Date.now();
  const lastTriggeredAt = recentJobTriggers.get(cacheKey) ?? 0;

  if (now - lastTriggeredAt < JOB_DEBOUNCE_MS) {
    return;
  }

  recentJobTriggers.set(cacheKey, now);
  await runPolicyDrivenPipeline("job_updated", input);
}

export async function onCandidateChanged(input: PipelineTriggerInput) {
  await runPolicyDrivenPipeline("candidate_ingested", input);
}
