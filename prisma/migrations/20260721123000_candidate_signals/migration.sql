-- Add candidate signal fields to match results
ALTER TABLE "MatchResult" ADD COLUMN "candidateSignalScore" INTEGER;
ALTER TABLE "MatchResult" ADD COLUMN "candidateSignalBreakdown" JSONB;

-- Track outreach interactions tied to candidates and job requisitions
CREATE TABLE "OutreachInteraction" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobReqId" TEXT NOT NULL,
    "agentRunId" TEXT,
    "interactionType" TEXT NOT NULL DEFAULT 'OUTREACH_GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachInteraction_pkey" PRIMARY KEY ("id")
);

-- Indexes for faster lookup when calculating engagement signals
CREATE INDEX "OutreachInteraction_candidateId_idx" ON "OutreachInteraction"("candidateId");
CREATE INDEX "OutreachInteraction_jobReqId_idx" ON "OutreachInteraction"("jobReqId");
CREATE INDEX "OutreachInteraction_agentRunId_idx" ON "OutreachInteraction"("agentRunId");

-- Relationships
ALTER TABLE "OutreachInteraction" ADD CONSTRAINT "OutreachInteraction_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutreachInteraction" ADD CONSTRAINT "OutreachInteraction_jobReqId_fkey" FOREIGN KEY ("jobReqId") REFERENCES "JobReq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutreachInteraction" ADD CONSTRAINT "OutreachInteraction_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRunLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
