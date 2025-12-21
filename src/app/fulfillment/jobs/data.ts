import { prisma } from "@/server/db/prisma";

export type FulfillmentJobRecord = {
  id: string;
  title: string;
  client: string;
  status: string;
  priority: string;
  updatedAt: string;
  owner: string;
  needsAction: boolean;
  location?: string | null;
  summary?: string | null;
  source: "database" | "seed";
};

const FALLBACK_PRIORITIES = ["P0 - Critical", "P1 - High", "P2 - Standard", "P3 - Low"] as const;
const FALLBACK_OWNERS = ["Priya Shah", "Alex Rivera", "Morgan Lee", "Taylor Chen", "Samir Patel"] as const;
const FALLBACK_STATUSES = ["Intake", "Sourcing", "Interviewing", "Offer", "On Hold", "Closed"] as const;

const SEEDED_FULFILLMENT_JOBS: FulfillmentJobRecord[] = [
  {
    id: "seed-fulfillment-1",
    title: "AI Platform Engineer",
    client: "Northwind Solar",
    status: "Intake",
    priority: "P0 - Critical",
    updatedAt: new Date().toISOString(),
    owner: "Priya Shah",
    needsAction: true,
    location: "Remote (US)",
    summary: "Building data plane for fulfillment telemetry; waiting on hiring panel availability.",
    source: "seed",
  },
  {
    id: "seed-fulfillment-2",
    title: "Implementation Manager",
    client: "Proxima Logistics",
    status: "Sourcing",
    priority: "P1 - High",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    owner: "Alex Rivera",
    needsAction: false,
    location: "Austin, TX",
    summary: "Need 3 candidates with B2B onboarding experience; waiting on candidate slate.",
    source: "seed",
  },
  {
    id: "seed-fulfillment-3",
    title: "Customer Success Lead",
    client: "Atlas Retail",
    status: "Interviewing",
    priority: "P2 - Standard",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    owner: "Morgan Lee",
    needsAction: false,
    location: "Hybrid (Seattle, WA)",
    summary: "Panel in progress; need notes from yesterday's on-site.",
    source: "seed",
  },
  {
    id: "seed-fulfillment-4",
    title: "Revenue Operations Analyst",
    client: "Helios Networks",
    status: "On Hold",
    priority: "P3 - Low",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
    owner: "Taylor Chen",
    needsAction: true,
    location: "Remote (Canada)",
    summary: "Paused pending revised headcount approval; flag if still open by Friday.",
    source: "seed",
  },
  {
    id: "seed-fulfillment-5",
    title: "Technical Program Manager",
    client: "LumenOps",
    status: "Offer",
    priority: "P1 - High",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    owner: "Samir Patel",
    needsAction: true,
    location: "San Francisco, CA",
    summary: "Offer sent; awaiting comp review and start date confirmation.",
    source: "seed",
  },
];

function determineNeedsAction(status: string | null | undefined, updatedAt: Date) {
  if (!status) return true;
  const normalized = status.trim().toLowerCase();
  if (["on hold", "blocked", "pending client"].includes(normalized)) {
    return true;
  }

  const ageInDays = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays >= 3;
}

async function loadJobsFromDatabase(): Promise<FulfillmentJobRecord[]> {
  try {
    const jobs = await prisma.jobReq.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        location: true,
        updatedAt: true,
        createdAt: true,
        customer: { select: { name: true } },
        rawDescription: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    return jobs.map((job, index) => {
      const updatedAt = job.updatedAt ?? job.createdAt;
      const priority = FALLBACK_PRIORITIES[index % FALLBACK_PRIORITIES.length];
      const owner = FALLBACK_OWNERS[index % FALLBACK_OWNERS.length];
      const status = job.status ?? FALLBACK_STATUSES[index % FALLBACK_STATUSES.length];
      const needsAction = determineNeedsAction(status, updatedAt);

      return {
        id: job.id,
        title: job.title,
        client: job.customer?.name ?? "Unassigned client",
        status,
        priority,
        updatedAt: updatedAt.toISOString(),
        owner,
        needsAction,
        location: job.location,
        summary: job.rawDescription?.slice(0, 180) ?? null,
        source: "database" as const,
      } satisfies FulfillmentJobRecord;
    });
  } catch (error) {
    console.error("[fulfillment/jobs] Failed to load jobs from database", error);
    return [];
  }
}

export async function getFulfillmentJobs() {
  const jobs = await loadJobsFromDatabase();

  if (jobs.length > 0) {
    return { jobs, source: "database" as const };
  }

  return { jobs: SEEDED_FULFILLMENT_JOBS, source: "seed" as const };
}

export async function getFulfillmentJob(jobId: string): Promise<FulfillmentJobRecord | null> {
  const { jobs } = await getFulfillmentJobs();
  return jobs.find((job) => job.id === jobId) ?? null;
}
