import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const getCurrentUser = vi.hoisted(() => vi.fn());
const getCurrentTenantId = vi.hoisted(() => vi.fn());
const seedEatSampleData = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({ getCurrentUser }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenantId }));
vi.mock("@/lib/testing/sampleDataSeeder", () => ({ seedEatSampleData }));

describe("POST /api/admin/ete/seed-sample-data", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    getCurrentUser.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/admin/ete/seed-sample-data");
    const response = await POST(request as unknown as Request);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 when the user is not an admin for the tenant", async () => {
    getCurrentUser.mockResolvedValue({ role: "RECRUITER", tenantId: "tenant-a" });
    getCurrentTenantId.mockResolvedValue("tenant-a");

    const request = new NextRequest("http://localhost/api/admin/ete/seed-sample-data");
    const response = await POST(request as unknown as Request);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("seeds data for matching tenant admins", async () => {
    getCurrentUser.mockResolvedValue({ role: "ADMIN", tenantId: "tenant-a" });
    getCurrentTenantId.mockResolvedValue("tenant-a");
    seedEatSampleData.mockResolvedValue({ jobReqId: "job-1", candidateIds: ["c1", "c2", "c3"] });

    const request = new NextRequest("http://localhost/api/admin/ete/seed-sample-data");
    const response = await POST(request as unknown as Request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ jobReqId: "job-1", candidateIds: ["c1", "c2", "c3"] });
    expect(seedEatSampleData).toHaveBeenCalledWith("tenant-a");
  });
});
