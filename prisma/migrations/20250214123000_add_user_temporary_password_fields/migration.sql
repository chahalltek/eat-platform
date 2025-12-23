-- Add temporary password tracking for admin resets
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "temporaryPasswordHash" TEXT,
  ADD COLUMN IF NOT EXISTS "temporaryPasswordSetAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "temporaryPasswordExpiresAt" TIMESTAMP(3);
