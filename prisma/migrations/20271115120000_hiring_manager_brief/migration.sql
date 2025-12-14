-- CreateEnum
CREATE TYPE "HiringManagerBriefStatus" AS ENUM ('DRAFT', 'READY', 'SENT');

-- CreateTable
CREATE TABLE "HiringManagerBrief" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "jobReqId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" "HiringManagerBriefStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentTo" TEXT,

    CONSTRAINT "HiringManagerBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HiringManagerBrief_tenantId_idx" ON "HiringManagerBrief"("tenantId");
CREATE INDEX "HiringManagerBrief_tenantId_jobReqId_idx" ON "HiringManagerBrief"("tenantId", "jobReqId");

-- AddForeignKey
ALTER TABLE "HiringManagerBrief" ADD CONSTRAINT "HiringManagerBrief_jobReqId_fkey" FOREIGN KEY ("jobReqId") REFERENCES "JobReq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
