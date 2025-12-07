'use client';

import { useState } from 'react';

export default function RinaTestPage() {
  const [resumeText, setResumeText] = useState(
    'Jane Doe\nSenior Data Engineer\n8 years experience in Python, SQL, Snowflake, Airflow.\nPreviously at Amazon and Target.\nBased in Minneapolis, MN.'
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/agents/rina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruiterId: 'charlie',
          rawResumeText: resumeText,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-start p-8 gap-6 bg-slate-50">
      <div className="w-full max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">EAT-TS · RINA Test Console</h1>
        <p className="text-sm text-slate-600">
          Paste a resume below and send it through the RINA agent. 
          On success you&apos;ll get back a candidateId and agentRunId.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            className="w-full h-64 border rounded-md p-3 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-md text-white bg-indigo-600 disabled:opacity-60"
          >
            {loading ? 'Sending to RINA…' : 'Run RINA'}
          </button>
        </form>

        {error && (
          <div className="mt-4 text-sm text-red-600">
            Error: {error}
          </div>
        )}

        {result && (
          <div className="mt-4 text-sm">
            <h2 className="font-semibold mb-2">Result</h2>
            <pre className="bg-white border rounded-md p-3 overflow-x-auto text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
            <p className="mt-2 text-slate-600">
              Use <code>candidateId</code> to look up the full record in the database.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
