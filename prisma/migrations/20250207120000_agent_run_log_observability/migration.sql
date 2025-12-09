-- CreateEnum
-- db-safety-ignore-destructive: dropping legacy status column after migration.
CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'ERROR');

-- AlterTable
ALTER TABLE "AgentRunLog" ADD COLUMN     "durationMs" INTEGER;
ALTER TABLE "AgentRunLog" ADD COLUMN     "inputSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "AgentRunLog" ADD COLUMN     "outputSnapshot" JSONB;
ALTER TABLE "AgentRunLog" ADD COLUMN     "status_new" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING';
UPDATE "AgentRunLog" SET "status_new" = CASE "status"
  WHEN 'Success' THEN 'SUCCESS'::"AgentRunStatus"
  WHEN 'Failure' THEN 'ERROR'::"AgentRunStatus"
  WHEN 'Running' THEN 'RUNNING'::"AgentRunStatus"
  ELSE 'RUNNING'::"AgentRunStatus"
END;
ALTER TABLE "AgentRunLog" DROP COLUMN "status";
ALTER TABLE "AgentRunLog" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "AgentRunLog" ALTER COLUMN "inputSnapshot" DROP DEFAULT;
ALTER TABLE "AgentRunLog" ALTER COLUMN "status" SET DEFAULT 'RUNNING';

