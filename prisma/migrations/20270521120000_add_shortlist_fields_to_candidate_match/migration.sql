-- AlterTable
ALTER TABLE "CandidateMatch" ADD COLUMN     "shortlisted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CandidateMatch" ADD COLUMN     "shortlistReason" TEXT;
