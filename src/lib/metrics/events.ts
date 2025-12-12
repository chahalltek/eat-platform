import { prisma } from "@/lib/prisma";

export type MetricEventType =
  | "JOB_CREATED"
  | "JOB_UPDATED"
  | "CANDIDATE_INGESTED"
  | "PIPELINE_RUN_COMPLETED"
  | "SHORTLIST_CREATED"
  | "EXPLANATION_GENERATED"
  | "MATCH_RUN";

export type MetricEventPayload = {
  tenantId: string;
  eventType: MetricEventType | (string & {});
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
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
