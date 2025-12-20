-- Add confidence scoring fields to JobCandidate
ALTER TABLE "JobCandidate"
  ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "confidenceBand" TEXT,
  ADD COLUMN IF NOT EXISTS "confidenceReasons" JSONB,
  ADD COLUMN IF NOT EXISTS "confidenceNarrative" TEXT,
  ADD COLUMN IF NOT EXISTS "confidenceSignals" JSONB,
  ADD COLUMN IF NOT EXISTS "confidenceUpdatedAt" TIMESTAMP(3);
