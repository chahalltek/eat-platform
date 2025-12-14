-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('WIDEN_CRITERIA', 'ADJUST_COMP', 'SOURCE_EXTERNALLY', 'ESCALATE_TO_HM', 'PUSH_CANDIDATES', 'PAUSE_REQUISITION');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "AgentActionApproval" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "jobReqId" TEXT,
    "candidateId" TEXT,
    "actionType" "ActionType" NOT NULL,
    "actionPayload" JSONB NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "decisionStreamId" TEXT,

    CONSTRAINT "AgentActionApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentActionApproval_tenantId_status_idx" ON "AgentActionApproval"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AgentActionApproval_tenantId_jobReqId_idx" ON "AgentActionApproval"("tenantId", "jobReqId");

-- CreateIndex
CREATE INDEX "AgentActionApproval_tenantId_candidateId_idx" ON "AgentActionApproval"("tenantId", "candidateId");

-- AddForeignKey
ALTER TABLE "AgentActionApproval" ADD CONSTRAINT "AgentActionApproval_jobReqId_fkey" FOREIGN KEY ("jobReqId") REFERENCES "JobReq"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActionApproval" ADD CONSTRAINT "AgentActionApproval_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActionApproval" ADD CONSTRAINT "AgentActionApproval_decisionStreamId_fkey" FOREIGN KEY ("decisionStreamId") REFERENCES "DecisionStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

