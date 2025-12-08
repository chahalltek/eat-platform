import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { CandidateTable, type CandidateRow } from "./CandidateTable";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  let rows: CandidateRow[] = [];
  let errorMessage: string | null = null;

  try {
    const candidates = await prisma.candidate.findMany({
      include: {
        skills: {
          select: {
            id: true,
            name: true,
            proficiency: true,
            yearsOfExperience: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    rows = candidates.map((candidate) => {
      return {
        id: candidate.id,
        fullName: candidate.fullName,
        currentTitle: candidate.currentTitle,
        location: candidate.location,
        status: candidate.status,
        parsingConfidence: candidate.parsingConfidence,
        updatedAt: candidate.updatedAt.toISOString(),
      } satisfies CandidateRow;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      errorMessage = "Candidates are temporarily unavailable while the database is being updated.";
      console.error("[CandidatesPage] Missing column on Candidate table", error);
    } else {
      errorMessage = "Unable to load candidates right now. Please try again later.";
      console.error("[CandidatesPage] Failed to load candidates", error);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Candidates</h1>
          <p className="text-sm text-gray-600">Search, sort, and browse recent candidates.</p>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          {errorMessage}
        </div>
      )}

      <CandidateTable candidates={rows} />
    </div>
  );
}
