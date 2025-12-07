-- AlterTable
ALTER TABLE "MatchResult" ADD COLUMN "jobCandidateId" TEXT;

-- CreateIndex
CREATE INDEX "MatchResult_jobCandidateId_idx" ON "MatchResult"("jobCandidateId");

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_jobCandidateId_fkey" FOREIGN KEY ("jobCandidateId") REFERENCES "JobCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RedefineIndex
DROP INDEX IF EXISTS "JobCandidate_lastMatchResultId_idx";
CREATE UNIQUE INDEX "JobCandidate_lastMatchResultId_key" ON "JobCandidate"("lastMatchResultId");
