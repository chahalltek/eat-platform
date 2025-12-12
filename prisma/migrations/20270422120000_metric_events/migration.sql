-- CreateTable
CREATE TABLE "MetricEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "eventType" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetricEvent_tenantId_idx" ON "MetricEvent"("tenantId");

-- CreateIndex
CREATE INDEX "MetricEvent_tenantId_eventType_idx" ON "MetricEvent"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "MetricEvent_createdAt_idx" ON "MetricEvent"("createdAt");
