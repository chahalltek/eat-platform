-- Create new AgentRunStatus enum with FAILED and PARTIAL
CREATE TYPE "AgentRunStatus_new" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- Add retry metadata columns
ALTER TABLE "AgentRunLog" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AgentRunLog" ADD COLUMN "retryOfId" TEXT;

-- Add status column using new enum and migrate data
ALTER TABLE "AgentRunLog" ADD COLUMN "status_new" "AgentRunStatus_new" NOT NULL DEFAULT 'RUNNING';
UPDATE "AgentRunLog" SET "status_new" = CASE
  WHEN "status" = 'ERROR' THEN 'FAILED'
  ELSE "status"::text::"AgentRunStatus_new"
END;

-- Swap columns and enums
ALTER TABLE "AgentRunLog" DROP COLUMN "status";
ALTER TYPE "AgentRunStatus" RENAME TO "AgentRunStatus_old";
ALTER TYPE "AgentRunStatus_new" RENAME TO "AgentRunStatus";
ALTER TABLE "AgentRunLog" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "AgentRunLog" ALTER COLUMN "status" SET DEFAULT 'RUNNING';
DROP TYPE "AgentRunStatus_old";

-- Add retry reference
ALTER TABLE "AgentRunLog" ADD CONSTRAINT "AgentRunLog_retryOfId_fkey" FOREIGN KEY ("retryOfId") REFERENCES "AgentRunLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AgentRunLog_retryOfId_idx" ON "AgentRunLog"("retryOfId");
