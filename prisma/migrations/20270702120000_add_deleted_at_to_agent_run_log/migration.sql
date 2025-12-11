-- Add soft-delete support to AgentRunLog
ALTER TABLE "AgentRunLog" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Maintain index for filtered lookups
CREATE INDEX IF NOT EXISTS "AgentRunLog_deletedAt_idx" ON "AgentRunLog"("deletedAt");
