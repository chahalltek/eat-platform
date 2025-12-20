import type { Prisma } from "@/server/db/prisma";

import { prisma } from "@/server/db/prisma";

export type MetricEventType =
  | "JOB_CREATED"
  | "JOB_UPDATED"
  | "CANDIDATE_INGESTED"
  | "PIPELINE_RUN_COMPLETED"
  | "SHORTLIST_CREATED"
  | "EXPLANATION_GENERATED"
  | "MATCH_RUN"
  | "RECRUITER_BEHAVIOR_CANDIDATE_OPEN"
  | "RECRUITER_BEHAVIOR_EXPLANATION_EXPANDED"
  | "RECRUITER_BEHAVIOR_SHORTLIST_OVERRIDE"
  | "RECRUITER_BEHAVIOR_DECISION_TIME"
  | "DECISION_STREAM_CREATED"
  | "DECISION_STREAM_ITEM"
  | "DECISION_RECEIPT_CREATED"
  | "DECISION_RECEIPT_PUSHED";

export type MetricEventPayload = {
  tenantId: string;
  eventType: MetricEventType | (string & {});
  entityId?: string | null;
  meta?: Prisma.InputJsonValue | null;
};

export async function recordMetricEvent({ tenantId, eventType, entityId, meta }: MetricEventPayload) {
  try {
    await prisma.metricEvent.create({
      data: {
        tenantId,
        eventType,
        entityId: entityId ?? null,
        meta: meta ?? undefined,
      },
    });
  } catch (error) {
    console.error("Failed to record metric event", {
      tenantId,
      eventType,
      entityId,
      error,
    });
  }
}
