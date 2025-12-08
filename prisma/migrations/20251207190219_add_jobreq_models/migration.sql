-- db-safety-ignore-destructive: legacy JobReq fields and table cleanup after refactor.
/*
  Warnings:

  - You are about to drop the column `ambiguityScore` on the `JobReq` table. All the data in the column will be lost.
  - You are about to drop the column `clientName` on the `JobReq` table. All the data in the column will be lost.
  - You are about to drop the column `descriptionRaw` on the `JobReq` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `JobReq` table. All the data in the column will be lost.
  - You are about to drop the column `remoteType` on the `JobReq` table. All the data in the column will be lost.
  - You are about to drop the column `responsibilitiesSummary` on the `JobReq` table. All the data in the column will be lost.
  - You are about to drop the column `teamContext` on the `JobReq` table. All the data in the column will be lost.
  - You are about to drop the `JobSkillRequirement` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `rawDescription` to the `JobReq` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "JobSkillRequirement" DROP CONSTRAINT "JobSkillRequirement_jobReqId_fkey";

-- AlterTable
ALTER TABLE "JobReq" DROP COLUMN "ambiguityScore",
DROP COLUMN "clientName",
DROP COLUMN "descriptionRaw",
DROP COLUMN "priority",
DROP COLUMN "remoteType",
DROP COLUMN "responsibilitiesSummary",
DROP COLUMN "teamContext",
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "rawDescription" TEXT NOT NULL,
ADD COLUMN     "salaryCurrency" TEXT,
ADD COLUMN     "salaryInterval" TEXT,
ADD COLUMN     "salaryMax" INTEGER,
ADD COLUMN     "salaryMin" INTEGER;

-- DropTable
DROP TABLE "JobSkillRequirement";

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSkill" (
    "id" TEXT NOT NULL,
    "jobReqId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "weight" DOUBLE PRECISION,

    CONSTRAINT "JobSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobSkill_jobReqId_idx" ON "JobSkill"("jobReqId");

-- CreateIndex
CREATE INDEX "JobSkill_normalizedName_idx" ON "JobSkill"("normalizedName");

-- AddForeignKey
ALTER TABLE "JobReq" ADD CONSTRAINT "JobReq_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSkill" ADD CONSTRAINT "JobSkill_jobReqId_fkey" FOREIGN KEY ("jobReqId") REFERENCES "JobReq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
