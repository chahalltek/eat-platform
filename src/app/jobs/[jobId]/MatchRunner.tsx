"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { normalizeMatchExplanation } from "@/lib/matching/explanation";

type MatchResponse = {
  score: number;
  reasons?: unknown;
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
        <MatchResultDetails result={result} />
      )}
    </div>
  );
}

function MatchResultDetails({ result }: { result: MatchResponse }) {
  const explanation = normalizeMatchExplanation(result.reasons);

  return (
    <div className="mt-6 space-y-4">
      <div className="text-sm text-gray-700">
        <span className="font-semibold text-gray-900">Score:</span> {result.score}
      </div>

      <div>
        <div className="text-sm font-semibold text-gray-900">Top reasons</div>
        {explanation.topReasons.length === 0 ? (
          <p className="text-sm text-gray-700">No reasons provided.</p>
        ) : (
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">
            {explanation.topReasons.map((reason, index) => (
              <li key={`${reason}-${index}`}>{reason}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="text-sm font-semibold text-gray-900">Risk areas</div>
        {explanation.riskAreas.length === 0 ? (
          <p className="text-sm text-gray-700">No significant risks detected.</p>
        ) : (
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">
            {explanation.riskAreas.map((risk, index) => (
              <li key={`${risk}-${index}`}>{risk}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="text-sm font-semibold text-gray-900">Skill overlap map</div>
        {explanation.skillOverlapMap.length === 0 ? (
          <p className="text-sm text-gray-700">No skill overlap information available.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {explanation.skillOverlapMap.map((entry) => (
              <li
                key={`${entry.skill}-${entry.importance}-${entry.status}`}
                className="flex items-start justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <div>
                  <span className="font-medium text-gray-900">{entry.skill}</span>{" "}
                  <span className="text-xs text-gray-600">({entry.importance})</span>
                  <div className="text-xs text-gray-600">{entry.note}</div>
                </div>
                <span
                  className={`text-xs font-semibold ${entry.status === "matched" ? "text-green-700" : "text-red-700"}`}
                >
                  {entry.status === "matched" ? "Matched" : "Missing"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="text-sm font-semibold text-gray-900">Exportable explanation</div>
        <textarea
          readOnly
          className="mt-2 w-full rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800"
          rows={4}
          value={explanation.exportableText}
        />
      </div>
    </div>
  );
}
