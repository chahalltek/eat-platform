import { prisma } from "@/lib/prisma";
import { CandidateTable, type CandidateRow } from "./CandidateTable";

export default async function CandidatesPage() {
  const candidates = await prisma.candidate.findMany({
    select: {
      id: true,
      fullName: true,
      currentTitle: true,
      location: true,
      parsingConfidence: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const rows: CandidateRow[] = candidates.map((candidate) => ({
    ...candidate,
    updatedAt: candidate.updatedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Candidates</h1>
          <p className="text-sm text-gray-600">Search, sort, and browse recent candidates.</p>
        </div>
      </div>

      <CandidateTable candidates={rows} />
    </div>
  );
}
