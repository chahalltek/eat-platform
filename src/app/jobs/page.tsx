import { JobTable, type JobTableRow } from "./JobTable";
import { prisma } from "@/lib/prisma";

function formatSource(job: { sourceType: string | null; sourceTag: string | null }) {
  if (job.sourceType && job.sourceTag) {
    return `${job.sourceType} • ${job.sourceTag}`;
  }

  if (job.sourceType) return job.sourceType;
  if (job.sourceTag) return job.sourceTag;
  return "—";
}

export default async function JobsPage() {
  const jobs = await prisma.jobReq
    .findMany({
      select: {
        id: true,
        title: true,
        location: true,
        sourceType: true,
        sourceTag: true,
        createdAt: true,
        updatedAt: true,
        matchResults: {
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    .catch((error) => {
      console.error("Failed to load job requisitions", error);
      return [];
    });

  const tableRows: JobTableRow[] = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    customerName: job.customer?.name ?? null,
    location: job.location ?? null,
    source: formatSource(job),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt?.toISOString() ?? null,
    latestMatchActivity: job.matchResults[0]?.createdAt?.toISOString() ?? null,
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Job Requisitions</h1>
          <p className="text-sm text-gray-600">
            Showing the 50 most recent job requisitions.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <JobTable jobs={tableRows} />
      </div>
    </div>
  );
}
