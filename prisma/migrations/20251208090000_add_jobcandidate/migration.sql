-- CreateEnum
CREATE TYPE "JobCandidateStatus" AS ENUM ('POTENTIAL', 'SHORTLISTED', 'SUBMITTED', 'INTERVIEWING', 'HIRED', 'REJECTED');

-- CreateTable
CREATE TABLE "JobCandidate" (
    "id" TEXT NOT NULL,
    "jobReqId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" "JobCandidateStatus" NOT NULL DEFAULT 'POTENTIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMatchResultId" TEXT,
    "notes" TEXT,

    CONSTRAINT "JobCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobCandidate_jobReqId_idx" ON "JobCandidate"("jobReqId");

-- CreateIndex
CREATE INDEX "JobCandidate_candidateId_idx" ON "JobCandidate"("candidateId");

-- CreateIndex
CREATE INDEX "JobCandidate_lastMatchResultId_idx" ON "JobCandidate"("lastMatchResultId");

-- AddForeignKey
ALTER TABLE "JobCandidate" ADD CONSTRAINT "JobCandidate_jobReqId_fkey" FOREIGN KEY ("jobReqId") REFERENCES "JobReq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCandidate" ADD CONSTRAINT "JobCandidate_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCandidate" ADD CONSTRAINT "JobCandidate_lastMatchResultId_fkey" FOREIGN KEY ("lastMatchResultId") REFERENCES "MatchResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

