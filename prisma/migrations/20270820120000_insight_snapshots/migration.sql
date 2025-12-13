-- Insight snapshots to support shareable artifacts

CREATE TABLE IF NOT EXISTS "InsightSnapshot" (
  "id" TEXT PRIMARY KEY,
  "releaseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "audience" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "contentJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "InsightSnapshot_releaseId_idx" ON "InsightSnapshot"("releaseId");
CREATE INDEX IF NOT EXISTS "InsightSnapshot_status_idx" ON "InsightSnapshot"("status");
