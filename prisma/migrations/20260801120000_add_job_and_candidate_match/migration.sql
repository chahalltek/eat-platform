-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "normalizedSkills" TEXT[];

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "requiredSkills" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateMatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "explanation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateMatch_tenantId_jobId_idx" ON "CandidateMatch"("tenantId", "jobId");

-- CreateIndex
CREATE INDEX "CandidateMatch_tenantId_candidateId_idx" ON "CandidateMatch"("tenantId", "candidateId");

-- AddForeignKey
ALTER TABLE "CandidateMatch" ADD CONSTRAINT "CandidateMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateMatch" ADD CONSTRAINT "CandidateMatch_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

