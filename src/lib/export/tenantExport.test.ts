import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildTenantExportArchive, fetchTenantExportData, toNdjson } from "./tenantExport";

const prismaMock = vi.hoisted(() => ({
  candidate: { findMany: vi.fn() },
  jobReq: { findMany: vi.fn() },
  match: { findMany: vi.fn() },
  agentRunLog: { findMany: vi.fn() },
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: prismaMock,
}));

const tenantId = "tenant-a";

describe("tenant export logic", () => {
  beforeEach(() => {
    prismaMock.candidate.findMany.mockResolvedValue([
      { id: "c-1", tenantId },
      { id: "c-2", tenantId: "other" },
    ]);
    prismaMock.jobReq.findMany.mockResolvedValue([
      { id: "j-1", tenantId },
      { id: "j-2", tenantId: "other" },
    ]);
    prismaMock.match.findMany.mockResolvedValue([
      { id: "m-1", tenantId },
      { id: "m-2", tenantId: "other" },
    ]);
    prismaMock.agentRunLog.findMany.mockResolvedValue([
      { id: "l-1", tenantId },
      { id: "l-2", tenantId: "other" },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("filters data to the requested tenant and uses NDJSON", async () => {
    const data = await fetchTenantExportData(tenantId);

    expect(prismaMock.candidate.findMany).toHaveBeenCalledWith({ where: { tenantId } });
    expect(prismaMock.jobReq.findMany).toHaveBeenCalledWith({ where: { tenantId } });
    expect(prismaMock.match.findMany).toHaveBeenCalledWith({ where: { tenantId } });
    expect(prismaMock.agentRunLog.findMany).toHaveBeenCalledWith({ where: { tenantId } });

    expect(data).toEqual({
      candidates: [{ id: "c-1", tenantId }],
      jobs: [{ id: "j-1", tenantId }],
      matches: [{ id: "m-1", tenantId }],
      logs: [{ id: "l-1", tenantId }],
    });

    expect(toNdjson(data.candidates)).toBe(JSON.stringify({ id: "c-1", tenantId }));
    expect(toNdjson([])).toBe("");
  });

  it("builds a zip archive with per-collection NDJSON", async () => {
    const { archive } = await buildTenantExportArchive(tenantId);

    const zip = await JSZip.loadAsync(archive);
    const candidateContent = await zip.file("candidates.ndjson")?.async("text");
    const jobContent = await zip.file("jobs.ndjson")?.async("text");
    const matchContent = await zip.file("matches.ndjson")?.async("text");
    const logContent = await zip.file("logs.ndjson")?.async("text");

    expect(candidateContent).toContain("c-1");
    expect(candidateContent).not.toContain("c-2");
    expect(jobContent).toContain("j-1");
    expect(matchContent).toContain("m-1");
    expect(logContent).toContain("l-1");
  });
});
