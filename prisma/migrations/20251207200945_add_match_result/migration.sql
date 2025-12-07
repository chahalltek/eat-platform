-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobReqId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "skillScore" INTEGER,
    "seniorityScore" INTEGER,
    "locationScore" INTEGER,
    "agentRunId" TEXT,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchResult_candidateId_idx" ON "MatchResult"("candidateId");

-- CreateIndex
CREATE INDEX "MatchResult_jobReqId_idx" ON "MatchResult"("jobReqId");

-- CreateIndex
CREATE INDEX "MatchResult_agentRunId_idx" ON "MatchResult"("agentRunId");

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_jobReqId_fkey" FOREIGN KEY ("jobReqId") REFERENCES "JobReq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRunLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

