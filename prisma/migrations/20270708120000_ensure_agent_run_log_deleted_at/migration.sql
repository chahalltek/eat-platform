-- Ensure AgentRunLog has soft-delete support even if previous migration was skipped
ALTER TABLE "AgentRunLog" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Recreate supporting index if it was missed
CREATE INDEX IF NOT EXISTS "AgentRunLog_deletedAt_idx" ON "AgentRunLog"("deletedAt");
