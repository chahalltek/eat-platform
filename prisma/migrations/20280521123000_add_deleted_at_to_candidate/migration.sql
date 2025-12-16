-- Add soft-delete tracking to Candidate table
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Candidate_deletedAt_idx" ON "Candidate"("deletedAt");
