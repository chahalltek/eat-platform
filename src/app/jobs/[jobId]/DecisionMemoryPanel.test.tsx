// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

import { DecisionMemoryPanel } from "./DecisionMemoryPanel";

const draftDecision = {
  id: "dec-1",
  jobId: "job-1",
  jobReqId: "job-1",
  tenantId: "tenant-1",
  status: "DRAFT",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  publishedAt: null,
  candidateIds: [],
  payload: {
    job: { id: "job-1", title: "Demo role", location: null, summary: null, intentSummary: null },
    shortlist: [],
    agentOutputs: { shortlistDigest: [], intentSummary: null },
    rationale: { decision: "", risks: [], nextSteps: "" },
  },
};

describe("DecisionMemoryPanel", () => {
  it("disables publish for sourcers", () => {
    render(
      <DecisionMemoryPanel
        jobId="job-1"
        decisions={[draftDecision]}
        canCreate={true}
        canPublish={false}
      />,
    );

    const publishButton = screen.getByRole("button", { name: /publish draft/i });
    expect(publishButton).toBeDisabled();
  });
});
