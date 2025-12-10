-- Add tenantId columns to legacy tables to align with Prisma schema defaults.
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';
ALTER TABLE "CandidateSkill" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';
ALTER TABLE "JobReq" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';
ALTER TABLE "JobSkill" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';
ALTER TABLE "MatchResult" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';
ALTER TABLE "AgentRunLog" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';
ALTER TABLE "JobCandidate" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';
ALTER TABLE "OutreachInteraction" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';

CREATE INDEX IF NOT EXISTS "Candidate_tenantId_idx" ON "Candidate"("tenantId");
CREATE INDEX IF NOT EXISTS "CandidateSkill_tenantId_idx" ON "CandidateSkill"("tenantId");
CREATE INDEX IF NOT EXISTS "JobReq_tenantId_idx" ON "JobReq"("tenantId");
CREATE INDEX IF NOT EXISTS "Customer_tenantId_idx" ON "Customer"("tenantId");
CREATE INDEX IF NOT EXISTS "JobSkill_tenantId_idx" ON "JobSkill"("tenantId");
CREATE INDEX IF NOT EXISTS "Match_tenantId_idx" ON "Match"("tenantId");
CREATE INDEX IF NOT EXISTS "MatchResult_tenantId_idx" ON "MatchResult"("tenantId");
CREATE INDEX IF NOT EXISTS "AgentRunLog_tenantId_idx" ON "AgentRunLog"("tenantId");
CREATE INDEX IF NOT EXISTS "JobCandidate_tenantId_idx" ON "JobCandidate"("tenantId");
CREATE INDEX IF NOT EXISTS "OutreachInteraction_tenantId_idx" ON "OutreachInteraction"("tenantId");
