import { getAgentAvailability } from "@/lib/agents/agentAvailability";
import { runConfidence } from "@/lib/agents/confidence";
import { runExplainForJob } from "@/lib/agents/explain";
import { runMatcher } from "@/lib/agents/matcher";
import { runShortlist } from "@/lib/agents/shortlist";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { withTenantContext } from "@/lib/tenant";

export type PipelineStep = "MATCH" | "CONFIDENCE" | "EXPLAIN" | "SHORTLIST";

export type PipelineRequest = {
  tenantId: string;
  jobId: string;
  candidateIds?: string[]; // optional constraint
  steps: PipelineStep[];
  requestedByUserId?: string;
  mode?: "ui" | "auto";
};

export type PipelineResult = {
  jobId: string;
  executedSteps: PipelineStep[];
  skippedSteps: Array<{ step: PipelineStep; reason: string }>;
  outputs: {
    matchResults?: any;
    confidenceResults?: any;
    explainResults?: any;
    shortlistResults?: any;
  };
};

export async function runPipeline(req: PipelineRequest): Promise<PipelineResult> {
  const tenantMode = await loadTenantMode(req.tenantId);
  const availability = await getAgentAvailability(req.tenantId);
  const isFireDrill = tenantMode.mode === "fire_drill";
  const mode = req.mode ?? "ui";

  const executedSteps: PipelineStep[] = [];
  const skippedSteps: PipelineResult["skippedSteps"] = [];
  const outputs: PipelineResult["outputs"] = {};

  const skipStep = (step: PipelineStep, reason: string) => {
    skippedSteps.push({ step, reason });
  };

  const handlers: Record<PipelineStep, () => Promise<void>> = {
    MATCH: async () => {
      const result = await runMatcher({ jobId: req.jobId, recruiterId: req.requestedByUserId });
      outputs.matchResults = result;
    },
    CONFIDENCE: async () => {
      const result = await withTenantContext(req.tenantId, () =>
        runConfidence({ jobId: req.jobId, recruiterId: req.requestedByUserId }),
      );
      outputs.confidenceResults = result;
    },
    EXPLAIN: async () => {
      const result = await runExplainForJob({
        jobId: req.jobId,
        candidateIds: req.candidateIds,
        tenantId: req.tenantId,
      });
      outputs.explainResults = result;
    },
    SHORTLIST: async () => {
      const result = await withTenantContext(req.tenantId, () =>
        runShortlist({
          jobId: req.jobId,
          recruiterId: req.requestedByUserId,
          candidateIds: req.candidateIds,
          tenantId: req.tenantId,
        }),
      );
      outputs.shortlistResults = result;
    },
  };

  for (const step of req.steps) {
    if (isFireDrill && (step === "CONFIDENCE" || step === "EXPLAIN")) {
      skipStep(step, "Step disabled during Fire Drill mode");
      continue;
    }

    if (!availability.isEnabled(step)) {
      skipStep(step, `${step} agent is disabled for this tenant`);
      continue;
    }

    try {
      await handlers[step]();
      executedSteps.push(step);
    } catch (error) {
      if (mode === "auto") {
        const reason = error instanceof Error ? error.message : String(error);
        skipStep(step, reason);
        continue;
      }

      throw error;
    }
  }

  return {
    jobId: req.jobId,
    executedSteps,
    skippedSteps,
    outputs,
  } satisfies PipelineResult;
}
