import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as explainJobPost } from "@/app/api/jobs/[jobId]/explain/route";
import { POST as shortlistJobPost } from "@/app/api/jobs/[jobId]/shortlist/route";
import { makeRequest } from "@tests/test-utils/routeHarness";

const { mockRunExplainForJob, mockRunShortlist } = vi.hoisted(() => {
  return {
    mockRunExplainForJob: vi.fn(),
    mockRunShortlist: vi.fn(),
  };
});

vi.mock("@/lib/agents/explain", () => ({ runExplainForJob: mockRunExplainForJob }));
vi.mock("@/lib/agents/shortlist", () => ({ runShortlist: mockRunShortlist }));

const explainBody = { candidateIds: ["candidate-1", "candidate-2"] };
const shortlistBody = { recruiterId: "recruiter-1", shortlistLimit: 2 };

const mockShortlisted = [
  {
    matchId: "match-1",
    candidateId: "candidate-1",
    priorityScore: 88,
    recencyScore: 12,
    shortlistReason: "#1 candidate — priority 88, recency 12",
  },
  {
    matchId: "match-2",
    candidateId: "candidate-2",
    priorityScore: 75,
    recencyScore: 30,
    shortlistReason: "#2 candidate — priority 75, recency 30",
  },
];

describe("EXPLAIN and SHORTLIST job endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRunExplainForJob.mockResolvedValue({
      jobId: "job-123",
      explanations: [],
      agentRunId: "agent-run-explain",
    });

    mockRunShortlist.mockResolvedValue({
      jobId: "job-123",
      shortlisted: mockShortlisted,
      totalMatches: mockShortlisted.length,
      agentRunId: "agent-run-shortlist",
    });
  });

  it("returns explain results for a job's matches", async () => {
    const response = await explainJobPost(
      makeRequest({
        method: "POST",
        url: "http://localhost/api/jobs/job-123/explain",
        json: explainBody,
      }),
      { params: { jobId: "job-123" } },
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockRunExplainForJob).toHaveBeenCalledWith({
      jobId: "job-123",
      candidateIds: ["candidate-1", "candidate-2"],
    });
    expect(payload).toEqual({
      jobId: "job-123",
      explanations: [],
      agentRunId: "agent-run-explain",
    });
  });

  it("returns shortlist metadata for the job", async () => {
    const response = await shortlistJobPost(
      makeRequest({
        method: "POST",
        url: "http://localhost/api/jobs/job-123/shortlist",
        json: shortlistBody,
      }),
      { params: { jobId: "job-123" } },
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockRunShortlist).toHaveBeenCalledWith({
      recruiterId: "recruiter-1",
      jobId: "job-123",
      shortlistLimit: 2,
    });
    expect(payload).toEqual({
      jobId: "job-123",
      shortlisted: mockShortlisted,
      totalMatches: mockShortlisted.length,
      agentRunId: "agent-run-shortlist",
    });
  });
});
