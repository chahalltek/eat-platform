-- CreateTable
CREATE TABLE "DecisionStream" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "jobId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "DecisionStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "decisionStreamId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DecisionStream_tenantId_jobId_createdBy_status_idx" ON "DecisionStream"("tenantId", "jobId", "createdBy", "status");

-- CreateIndex
CREATE INDEX "DecisionItem_tenantId_decisionStreamId_idx" ON "DecisionItem"("tenantId", "decisionStreamId");

-- CreateIndex
CREATE INDEX "DecisionItem_tenantId_candidateId_idx" ON "DecisionItem"("tenantId", "candidateId");

-- AddForeignKey
ALTER TABLE "DecisionStream" ADD CONSTRAINT "DecisionStream_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobReq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionStream" ADD CONSTRAINT "DecisionStream_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionItem" ADD CONSTRAINT "DecisionItem_decisionStreamId_fkey" FOREIGN KEY ("decisionStreamId") REFERENCES "DecisionStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionItem" ADD CONSTRAINT "DecisionItem_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
