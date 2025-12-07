import Link from "next/link";

import { prisma } from "@/lib/prisma";

function formatDate(date: Date) {
  return date.toLocaleString();
}

function formatSource(candidate: {
  sourceType: string | null;
  sourceTag: string | null;
}) {
  if (candidate.sourceType && candidate.sourceTag) {
    return `${candidate.sourceType} • ${candidate.sourceTag}`;
  }

  if (candidate.sourceType) return candidate.sourceType;
  if (candidate.sourceTag) return candidate.sourceTag;
  return "—";
}

export default async function CandidatesPage() {
  const candidates = await prisma.candidate.findMany({
    select: {
      id: true,
      fullName: true,
      currentTitle: true,
      createdAt: true,
      sourceType: true,
      sourceTag: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Candidates</h1>
          <p className="text-sm text-gray-600">
            Showing the 50 most recent candidates.
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-800">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
            <tr>
              <th scope="col" className="px-4 py-3">
                Name
              </th>
              <th scope="col" className="px-4 py-3">
                Title
              </th>
              <th scope="col" className="px-4 py-3">
                Created
              </th>
              <th scope="col" className="px-4 py-3">
                Source
              </th>
              <th scope="col" className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {candidates.map((candidate) => (
              <tr key={candidate.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {candidate.fullName}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {candidate.currentTitle ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {formatDate(candidate.createdAt)}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {formatSource(candidate)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/candidates/${candidate.id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
