-- CreateTable
CREATE TABLE "MatchFeedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "matchResultId" TEXT NOT NULL,
    "jobReqId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobCandidateId" TEXT,
    "userId" TEXT,
    "direction" TEXT,
    "outcome" TEXT,
    "matchSignals" JSONB,
    "guardrailsPreset" TEXT,
    "systemMode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchFeedback_tenantId_matchResultId_idx" ON "MatchFeedback"("tenantId", "matchResultId");

-- CreateIndex
CREATE INDEX "MatchFeedback_tenantId_jobReqId_idx" ON "MatchFeedback"("tenantId", "jobReqId");

-- AddForeignKey
ALTER TABLE "MatchFeedback" ADD CONSTRAINT "MatchFeedback_matchResultId_fkey" FOREIGN KEY ("matchResultId") REFERENCES "MatchResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchFeedback" ADD CONSTRAINT "MatchFeedback_jobCandidateId_fkey" FOREIGN KEY ("jobCandidateId") REFERENCES "JobCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchFeedback" ADD CONSTRAINT "MatchFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
