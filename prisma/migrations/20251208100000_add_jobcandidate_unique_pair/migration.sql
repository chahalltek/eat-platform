-- CreateIndex
CREATE UNIQUE INDEX "JobCandidate_jobReqId_candidateId_key" ON "JobCandidate"("jobReqId", "candidateId");
