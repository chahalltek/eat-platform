-- Rename User.name to displayName and enforce a value
ALTER TABLE "User" RENAME COLUMN "name" TO "displayName";
UPDATE "User" SET "displayName" = COALESCE("displayName", email);
ALTER TABLE "User" ALTER COLUMN "displayName" SET NOT NULL;

-- Add recruiter ownership to JobCandidate
ALTER TABLE "JobCandidate" ADD COLUMN     "userId" TEXT;

-- Create indexes for the new relation
CREATE INDEX "JobCandidate_userId_idx" ON "JobCandidate"("userId");

-- Add foreign key constraint
ALTER TABLE "JobCandidate" ADD CONSTRAINT "JobCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
