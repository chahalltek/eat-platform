-- CreateTable
CREATE TABLE "AgentFlag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "agentName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentFlag_tenantId_agentName_key" ON "AgentFlag"("tenantId", "agentName");
CREATE INDEX "AgentFlag_tenantId_idx" ON "AgentFlag"("tenantId");
