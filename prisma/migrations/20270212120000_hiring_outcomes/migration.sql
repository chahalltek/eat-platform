-- Track hiring outcomes per job and candidate
CREATE TABLE "HiringOutcome" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "candidateIdString" TEXT,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiringOutcome_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HiringOutcome_tenantId_jobId_candidateId_key" ON "HiringOutcome"("tenantId", "jobId", "candidateId");
CREATE INDEX "HiringOutcome_tenantId_jobId_idx" ON "HiringOutcome"("tenantId", "jobId");
CREATE INDEX "HiringOutcome_tenantId_candidateId_idx" ON "HiringOutcome"("tenantId", "candidateId");

ALTER TABLE "HiringOutcome" ADD CONSTRAINT "HiringOutcome_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobReq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HiringOutcome" ADD CONSTRAINT "HiringOutcome_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
