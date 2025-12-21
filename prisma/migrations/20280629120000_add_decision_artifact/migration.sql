-- CreateEnum
CREATE TYPE "DecisionArtifactType" AS ENUM ('RECOMMENDATION', 'SHORTLIST', 'INTAKE_SUMMARY');

-- CreateEnum
CREATE TYPE "DecisionArtifactStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "DecisionArtifact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "jobId" TEXT,
    "candidateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "type" "DecisionArtifactType" NOT NULL,
    "status" "DecisionArtifactStatus" NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "DecisionArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DecisionArtifact_tenantId_idx" ON "DecisionArtifact"("tenantId");

-- CreateIndex
CREATE INDEX "DecisionArtifact_tenantId_jobId_idx" ON "DecisionArtifact"("tenantId", "jobId");

-- CreateIndex
CREATE INDEX "DecisionArtifact_tenantId_status_idx" ON "DecisionArtifact"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DecisionArtifact_tenantId_createdByUserId_idx" ON "DecisionArtifact"("tenantId", "createdByUserId");

-- AddForeignKey
ALTER TABLE "DecisionArtifact" ADD CONSTRAINT "DecisionArtifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobReq"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionArtifact" ADD CONSTRAINT "DecisionArtifact_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
