"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type MatchResponse = {
  score: number;
  reasons: string[];
};

type MatchRunnerProps = {
  jobReqId: string;
};

export function MatchRunner({ jobReqId }: MatchRunnerProps) {
  const [candidateId, setCandidateId] = useState("");
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobReqId, candidateId }),
      });

      if (!response.ok) {
        throw new Error("Failed to run matching");
      }

      const data = (await response.json()) as MatchResponse;
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Could not run matching. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Run Matching</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-gray-700" htmlFor="candidateId">
            Candidate ID
          </label>
          <input
            id="candidateId"
            name="candidateId"
            type="text"
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
            className="w-full flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Enter candidate ID"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {loading ? "Running..." : "Run"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-6 space-y-3">
          <div className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">Score:</span> {result.score}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Reasons</div>
            {result.reasons.length === 0 ? (
              <p className="text-sm text-gray-700">No reasons provided.</p>
            ) : (
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">
                {result.reasons.map((reason, index) => (
                  <li key={`${reason}-${index}`}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
