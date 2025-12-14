import { describe, expect, it, vi } from "vitest";

import { JobCandidateStatus } from "@/server/db";

import { setShortlistState } from "./shortlist";

const mockCandidateMatchUpdateMany = vi.fn();
const mockJobCandidateFindUnique = vi.fn();
const mockJobCandidateFindFirst = vi.fn();
const mockJobCandidateUpdate = vi.fn();
const mockJobCandidateCreate = vi.fn();

const mockDb = {
  candidateMatch: {
    updateMany: mockCandidateMatchUpdateMany,
  },
  jobCandidate: {
    findUnique: mockJobCandidateFindUnique,
    findFirst: mockJobCandidateFindFirst,
    update: mockJobCandidateUpdate,
    create: mockJobCandidateCreate,
  },
};

describe("setShortlistState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates shortlist flags and promotes pipeline status", async () => {
    mockJobCandidateFindFirst.mockResolvedValue({
      id: "jc-1",
      status: JobCandidateStatus.POTENTIAL,
    });

    await setShortlistState("job-1", "cand-1", true, "ranked #1", {
      tenantId: "tenant-1",
      db: mockDb,
    });

    expect(mockCandidateMatchUpdateMany).toHaveBeenCalledWith({
      where: { jobId: "job-1", candidateId: "cand-1" },
      data: { shortlisted: true, shortlistReason: "ranked #1" },
    });
    expect(mockJobCandidateUpdate).toHaveBeenCalledWith({
      where: { id: "jc-1" },
      data: { status: JobCandidateStatus.SHORTLISTED },
    });
    expect(mockJobCandidateCreate).not.toHaveBeenCalled();
  });

  it("creates a job candidate when shortlisting a new match", async () => {
    mockJobCandidateFindFirst.mockResolvedValue(null);

    await setShortlistState("job-2", "cand-2", true, undefined, {
      tenantId: "tenant-1",
      db: mockDb,
    });

    expect(mockJobCandidateCreate).toHaveBeenCalledWith({
      data: {
        jobReqId: "job-2",
        candidateId: "cand-2",
        tenantId: "tenant-1",
        status: JobCandidateStatus.SHORTLISTED,
      },
    });
  });

  it("clears shortlist state and reverts pipeline status when appropriate", async () => {
    mockJobCandidateFindFirst.mockResolvedValue({
      id: "jc-3",
      status: JobCandidateStatus.SHORTLISTED,
    });

    await setShortlistState("job-3", "cand-3", false, "no longer top", {
      tenantId: "tenant-1",
      db: mockDb,
    });

    expect(mockCandidateMatchUpdateMany).toHaveBeenCalledWith({
      where: { jobId: "job-3", candidateId: "cand-3" },
      data: { shortlisted: false, shortlistReason: null },
    });
    expect(mockJobCandidateUpdate).toHaveBeenCalledWith({
      where: { id: "jc-3" },
      data: { status: JobCandidateStatus.POTENTIAL },
    });
  });

  it("does not downgrade progressed candidates when removing shortlist", async () => {
    mockJobCandidateFindFirst.mockResolvedValue({
      id: "jc-4",
      status: JobCandidateStatus.SUBMITTED,
    });

    await setShortlistState("job-4", "cand-4", false, undefined, {
      tenantId: "tenant-1",
      db: mockDb,
    });

    expect(mockCandidateMatchUpdateMany).toHaveBeenCalledWith({
      where: { jobId: "job-4", candidateId: "cand-4" },
      data: { shortlisted: false, shortlistReason: null },
    });
    expect(mockJobCandidateUpdate).not.toHaveBeenCalled();
  });
});
