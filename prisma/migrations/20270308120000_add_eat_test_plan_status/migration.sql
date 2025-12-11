-- CreateTable
CREATE TABLE "EatTestPlanStatus" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "itemId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "EatTestPlanStatus_tenantId_itemId_key" ON "EatTestPlanStatus"("tenantId", "itemId");
CREATE INDEX "EatTestPlanStatus_tenantId_idx" ON "EatTestPlanStatus"("tenantId");
CREATE INDEX "EatTestPlanStatus_tenantId_itemId_idx" ON "EatTestPlanStatus"("tenantId", "itemId");
