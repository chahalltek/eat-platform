-- Add missing source metadata columns to JobReq
ALTER TABLE "JobReq"
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceTag" TEXT;
