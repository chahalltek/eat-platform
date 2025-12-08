"use client";

import { useState } from "react";

type OutreachGeneratorProps = {
  candidateId: string;
  jobReqId: string;
};

type OutreachResponse = {
  message?: string;
  output?: string;
  error?: string;
};

export function OutreachGenerator({
  candidateId,
  jobReqId,
}: OutreachGeneratorProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  async function handleGenerate() {
    setIsOpen(true);
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/agents/outreach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recruiterId: "charlie",
          candidateId,
          jobReqId,
        }),
      });

      let data: OutreachResponse | null = null;

      try {
        data = (await response.json()) as OutreachResponse;
      } catch (jsonError) {
        console.warn("Failed to parse outreach response", jsonError);
      }

      if (!response.ok) {
        throw new Error(
          data?.error ?? data?.message ?? "Failed to generate outreach."
        );
      }

      setMessage(data?.message ?? data?.output ?? "No outreach message returned.");
    } catch (err) {
      console.error("Failed to generate outreach", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate outreach."
      );
    } finally {
      setIsLoading(false);
    }
  }

  const showPanel = isOpen && (isLoading || message || error);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isLoading}
        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        {isLoading ? "Generating..." : "Generate Outreach"}
      </button>

      {showPanel && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
          {isLoading && (
            <p className="text-gray-600">Generating outreach message...</p>
          )}

          {error && <p className="text-red-600">{error}</p>}

          {message && (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Draft outreach
              </p>
              <textarea
                readOnly
                value={message}
                className="w-full rounded-md border border-gray-200 bg-white p-3 font-sans text-sm leading-relaxed text-gray-900 shadow-inner focus:border-blue-400 focus:outline-none"
                rows={Math.min(12, Math.max(4, message.split("\n").length + 1))}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
