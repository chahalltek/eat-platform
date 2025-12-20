import JSZip from "jszip";

import { prisma } from "@/server/db/prisma";

export type TenantExportCollections = {
  candidates: unknown[];
  jobs: unknown[];
  matches: unknown[];
  logs: unknown[];
};

function filterByTenant(records: Array<{ tenantId?: string }>, tenantId: string) {
  return records.filter((record) => (record.tenantId ?? "").trim() === tenantId.trim());
}

function toNdjson(records: unknown[]) {
  return records.map((record) => JSON.stringify(record)).join("\n");
}

export async function fetchTenantExportData(tenantId: string): Promise<TenantExportCollections> {
  const [candidates, jobs, matches, logs] = await Promise.all([
    prisma.candidate.findMany({ where: { tenantId } }),
    prisma.jobReq.findMany({ where: { tenantId } }),
    prisma.match.findMany({ where: { tenantId } }),
    prisma.agentRunLog.findMany({ where: { tenantId } }),
  ]);

  return {
    candidates: filterByTenant(candidates, tenantId),
    jobs: filterByTenant(jobs, tenantId),
    matches: filterByTenant(matches, tenantId),
    logs: filterByTenant(logs, tenantId),
  };
}

export async function buildTenantExportArchive(tenantId: string) {
  const data = await fetchTenantExportData(tenantId);
  const zip = new JSZip();

  zip.file("candidates.ndjson", toNdjson(data.candidates));
  zip.file("jobs.ndjson", toNdjson(data.jobs));
  zip.file("matches.ndjson", toNdjson(data.matches));
  zip.file("logs.ndjson", toNdjson(data.logs));

  const archive = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return { archive, data };
}

export { toNdjson };
