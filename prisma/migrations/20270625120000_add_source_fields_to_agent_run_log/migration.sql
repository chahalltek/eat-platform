-- Ensure AgentRunLog has source metadata columns
ALTER TABLE "AgentRunLog" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "AgentRunLog" ADD COLUMN IF NOT EXISTS "sourceTag" TEXT;
