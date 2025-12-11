-- Add retry payload and raw resume text for agent retries
ALTER TABLE "AgentRunLog"
ADD COLUMN "retryPayload" JSONB,
ADD COLUMN "rawResumeText" TEXT;
