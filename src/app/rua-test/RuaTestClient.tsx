"use client";

import { useState } from "react";

import { BackToConsoleButton } from "@/components/BackToConsoleButton";

type RuaResult = {
  jobReqId: string;
  agentRunId: string;
};

type RuaTestClientProps = {
  agentsEnabled: boolean;
};

export function RuaTestClient({ agentsEnabled }: RuaTestClientProps) {
  const [jobText, setJobText] = useState<string>(
    "Acme Corp is hiring a Senior Backend Engineer.\nResponsibilities include building APIs in Node.js, working with PostgreSQL, and collaborating with product managers.\nThe role is hybrid in San Francisco and offers competitive benefits.",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RuaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<string>("manual");
  const [sourceTag, setSourceTag] = useState<string>("rua-test-page");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!agentsEnabled) {
      setError("Agents are disabled right now. Enable the Agents flag to run RUA.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        recruiterId: "charlie",
        rawJobText: jobText,
        sourceType: sourceType || undefined,
        sourceTag: sourceTag || undefined,
      };

      const response = await fetch("/api/agents/rua", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message =
          typeof errorBody.error === "string"
            ? errorBody.error
            : `Request failed with status ${response.status}`;
        throw new Error(message);
      }

      const data = (await response.json()) as RuaResult;
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">EAT-013</p>
          <h1 className="text-3xl font-semibold">RUA Test Console</h1>
          <p className="text-sm text-zinc-600">
            Paste a job description below and send it through the RUA agent. The response should mirror the JSON you get from
            curl today.
          </p>
          {!agentsEnabled && (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Agents are disabled. Enable the Agents feature flag to run this workflow.
            </div>
          )}
        </div>
        <BackToConsoleButton />
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-zinc-800" htmlFor="job-text">
          Job description
        </label>
        <textarea
          id="job-text"
          className="h-64 w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          value={jobText}
          onChange={(event) => setJobText(event.target.value)}
          placeholder="Paste job description text..."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-800" htmlFor="source-type">
              Source type (optional)
            </label>
            <input
              id="source-type"
              type="text"
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="e.g. manual"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-800" htmlFor="source-tag">
              Source tag (optional)
            </label>
            <input
              id="source-tag"
              type="text"
              value={sourceTag}
              onChange={(event) => setSourceTag(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="e.g. jira-ticket-123"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !agentsEnabled}
            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending to RUA…" : "Run RUA"}
          </button>
          {result ? (
            <span className="text-sm font-medium text-emerald-700">
              Job {result.jobReqId} • Agent Run {result.agentRunId}
            </span>
          ) : null}
          {error ? <span className="text-sm font-medium text-rose-700">{error}</span> : null}
        </div>
      </form>

      {error && !loading && !result && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Error: {error}
        </div>
      )}

      {result && (
        <section className="space-y-2 text-sm">
          <h2 className="text-base font-semibold text-zinc-800">Response</h2>
          <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-800">
            {JSON.stringify(result, null, 2)}
          </pre>
          <p className="text-zinc-600">
            Use <code>jobReqId</code> to find the job and <code>agentRunId</code> for the agent log.
          </p>
        </section>
      )}
    </div>
  );
}
