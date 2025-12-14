-- CreateTable
CREATE TABLE "JobIntent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "jobReqId" TEXT NOT NULL,
    "intent" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobIntent_jobReqId_key" ON "JobIntent"("jobReqId");
CREATE INDEX "JobIntent_tenantId_idx" ON "JobIntent"("tenantId");
CREATE INDEX "JobIntent_tenantId_jobReqId_idx" ON "JobIntent"("tenantId", "jobReqId");

-- AddForeignKey
ALTER TABLE "JobIntent" ADD CONSTRAINT "JobIntent_jobReqId_fkey" FOREIGN KEY ("jobReqId") REFERENCES "JobReq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobIntent" ADD CONSTRAINT "JobIntent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
