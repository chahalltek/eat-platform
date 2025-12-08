-- Track coverage reports for release quality monitoring
CREATE TABLE "CoverageReport" (
  "id" TEXT NOT NULL,
  "branch" TEXT NOT NULL DEFAULT 'main',
  "commitSha" TEXT,
  "coveragePercent" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoverageReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoverageReport_branch_createdAt_idx" ON "CoverageReport"("branch", "createdAt");
