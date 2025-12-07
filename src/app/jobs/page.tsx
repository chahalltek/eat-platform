import Link from "next/link";

import { prisma } from "@/lib/prisma";

function formatDate(date: Date) {
  return date.toLocaleString();
}

export default async function JobsPage() {
  const jobs = await prisma.jobReq
    .findMany({
      select: {
        id: true,
        title: true,
        location: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    .catch((error) => {
      console.error("Failed to load job requisitions", error);
      return [];
    });

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

      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {jobs.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-700">
            No job requisitions available.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-800">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Title
                </th>
                <th scope="col" className="px-4 py-3">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3">
                  Location
                </th>
                <th scope="col" className="px-4 py-3">
                  Created
                </th>
                <th scope="col" className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{job.title}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {job.customer?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{job.location ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(job.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
