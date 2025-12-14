-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "AgentActionApproval" ADD COLUMN     "executionStatus" "ExecutionStatus";
ALTER TABLE "AgentActionApproval" ADD COLUMN     "executedAt" TIMESTAMP(3);
ALTER TABLE "AgentActionApproval" ADD COLUMN     "executionResult" JSONB;
