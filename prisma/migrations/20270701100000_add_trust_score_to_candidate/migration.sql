-- Add trustScore column to Candidate for confidence scoring
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "trustScore" INTEGER;
