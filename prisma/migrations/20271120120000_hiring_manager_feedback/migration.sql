-- CreateEnum
CREATE TYPE "HiringManagerFeedbackType" AS ENUM ('REQUIREMENT_CHANGED', 'CANDIDATE_REJECTED', 'CANDIDATE_UPDATED', 'THRESHOLD_ADJUSTED');

-- CreateEnum
CREATE TYPE "HiringManagerFeedbackStatus" AS ENUM ('SUBMITTED', 'PROCESSED');

-- CreateTable
CREATE TABLE "HiringManagerFeedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "jobReqId" TEXT NOT NULL,
    "jobIntentId" TEXT,
    "candidateId" TEXT,
    "feedbackType" "HiringManagerFeedbackType" NOT NULL,
    "status" "HiringManagerFeedbackStatus" NOT NULL DEFAULT 'SUBMITTED',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringManagerFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HiringManagerFeedback_tenantId_idx" ON "HiringManagerFeedback"("tenantId");
CREATE INDEX "HiringManagerFeedback_tenantId_jobReqId_idx" ON "HiringManagerFeedback"("tenantId", "jobReqId");
CREATE INDEX "HiringManagerFeedback_tenantId_candidateId_idx" ON "HiringManagerFeedback"("tenantId", "candidateId");
CREATE INDEX "HiringManagerFeedback_tenantId_jobIntentId_idx" ON "HiringManagerFeedback"("tenantId", "jobIntentId");

-- AddForeignKey
ALTER TABLE "HiringManagerFeedback" ADD CONSTRAINT "HiringManagerFeedback_jobReqId_fkey" FOREIGN KEY ("jobReqId") REFERENCES "JobReq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HiringManagerFeedback" ADD CONSTRAINT "HiringManagerFeedback_jobIntentId_fkey" FOREIGN KEY ("jobIntentId") REFERENCES "JobIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HiringManagerFeedback" ADD CONSTRAINT "HiringManagerFeedback_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
