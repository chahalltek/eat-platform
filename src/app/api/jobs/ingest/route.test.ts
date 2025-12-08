/// <reference types="vitest/globals" />

const mocks = vi.hoisted(() => ({
  ingestJobMock: vi.fn(),
  getCurrentTenantIdMock: vi.fn(),
  prisma: { jobReq: { update: vi.fn() } },
}));

vi.mock("@/lib/matching/matcher", () => ({ ingestJob: mocks.ingestJobMock }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenantId: mocks.getCurrentTenantIdMock }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { POST } from "./route";

describe("POST /api/jobs/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentTenantIdMock.mockResolvedValue("tenant-123");
    mocks.ingestJobMock.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-123",
      title: "Backend Engineer",
      skills: [
        { name: "Node.js", normalizedName: "node.js", required: true, weight: 2 },
        { name: "PostgreSQL", normalizedName: "postgresql", required: false, weight: 2 },
      ],
    });
  });

  it("validates input and ingests a job", async () => {
    const request = new Request("http://localhost/api/jobs/ingest", {
      method: "POST",
      body: JSON.stringify({
        title: "Backend Engineer",
        location: "Remote",
        skills: [
          { name: "Node.js", required: true },
          { name: "PostgreSQL", weight: 2 },
        ],
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.ingestJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Backend Engineer" }),
      expect.anything(),
    );
    expect(payload.skills[0].normalizedName).toBe("node.js");
  });

  it("rejects invalid payloads", async () => {
    const request = new Request("http://localhost/api/jobs/ingest", {
      method: "POST",
      body: JSON.stringify({ skills: [{ name: "Node.js" }] }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("title is required");
    expect(mocks.ingestJobMock).not.toHaveBeenCalled();
  });
});

