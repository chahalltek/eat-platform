"use client";

import { useState } from "react";

type RinaResponse = {
  candidateId: string;
  agentRunId: string;
  [key: string]: unknown;
};

type RinaResult = {
  candidateId: string;
  agentRunId: string;
};

export default function RinaTestPage() {
  const [resumeText, setResumeText] = useState<string>(
    "Jane Doe\nSenior Data Engineer\n8 years experience in Python, SQL, Snowflake, Airflow.\nPreviously at Amazon and Target.\nBased in Minneapolis, MN."
  );
  const [loading, setLoading] = useState(false);
<<<<<<< ours
  const [result, setResult] = useState<RinaResponse | null>(null);
=======
  const [result, setResult] = useState<RinaResult | null>(null);
>>>>>>> theirs
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/agents/rina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recruiterId: "charlie",
          rawResumeText: resumeText,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message =
          typeof errorBody.error === "string"
            ? errorBody.error
            : `Request failed with status ${response.status}`;
        throw new Error(message);
      }

<<<<<<< ours
      const data = (await response.json()) as RinaResponse;
      setResult(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
=======
      const data = (await res.json()) as RinaResult;
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
>>>>>>> theirs
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            EAT-001
          </p>
          <h1 className="text-3xl font-semibold">RINA Test Console</h1>
          <p className="text-sm text-zinc-600">
            Paste a resume below and send it through the RINA agent. The response
            should mirror the JSON you get from curl today.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-zinc-800" htmlFor="resume">
            Resume text
          </label>
          <textarea
            id="resume"
            className="h-64 w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            placeholder="Paste raw resume text..."
          />

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Sending to RINA…" : "Run RINA"}
            </button>
            <p className="text-xs text-zinc-500">
              Payload: &#123; recruiterId: &quot;charlie&quot;, rawResumeText &#125;
            </p>
          </div>
        </form>

        {error && (
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
              Use <code>candidateId</code> to find the record and <code>agentRunId</code>
              for the agent log.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
