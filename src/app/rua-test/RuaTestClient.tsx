"use client";

import { useMemo, useRef, useState } from "react";

import type { RuaLLMResponse } from "@/lib/agents/contracts/ruaContract";

type RuaResult = {
  jobReqId: string;
  agentRunId: string;
  rua?: RuaLLMResponse | null;
};

type RuaTestClientProps = {
  agentsEnabled: boolean;
};

function splitSkills(skills: RuaLLMResponse["skills"] = []) {
  const mustHave = skills.filter((skill) => skill.isMustHave).slice(0, 12);
  const niceToHave = skills.filter((skill) => !skill.isMustHave).slice(0, 12);

  return { mustHave, niceToHave };
}

function summarizeRua(response?: RuaLLMResponse | null) {
  if (!response) return null;

  const { mustHave, niceToHave } = splitSkills(response.skills);

  return {
    title: response.title ?? null,
    level: response.seniorityLevel ?? null,
    location: response.location ?? null,
    remoteType: response.remoteType ?? null,
    employmentType: response.employmentType ?? null,
    responsibilities: response.responsibilitiesSummary ?? null,
    mustHaveSkills: mustHave.map((skill) => skill.normalizedName || skill.name),
    niceToHaveSkills: niceToHave.map((skill) => skill.normalizedName || skill.name),
  };
}

type RuaAmbiguityFields = RuaLLMResponse & {
  warnings?: string[];
  conflicts?: string[];
  missing?: string[];
  questions?: string[];
  clarificationsNeeded?: string[];
};

function deriveAmbiguity(response?: RuaAmbiguityFields | null) {
  if (!response) return { issues: [] as string[], hasSchemaFlags: false };

  const structuredFlags = [
    ...(response.warnings ?? []),
    ...(response.conflicts ?? []),
    ...(response.missing ?? []),
    ...(response.questions ?? []),
    ...(response.clarificationsNeeded ?? []),
  ].filter(Boolean);

  const missingEssentials: string[] = [];

  if (!response.location) {
    missingEssentials.push("Location is missing.");
  }
  if (!response.seniorityLevel) {
    missingEssentials.push("Level / seniority is missing.");
  }
  if (!response.employmentType) {
    missingEssentials.push("Employment type is missing.");
  }
  if (!response.skills?.some((skill) => skill.isMustHave)) {
    missingEssentials.push("Must-have skills are missing.");
  }

  const issues = [...structuredFlags, ...missingEssentials];
  const hasSchemaFlags =
    structuredFlags.length > 0 ||
    Boolean(
      response.warnings ??
        response.conflicts ??
        response.missing ??
        response.questions ??
        response.clarificationsNeeded,
    );

  return { issues, hasSchemaFlags };
}

function SummaryItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col rounded-lg border border-zinc-200 bg-white px-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="mt-1 text-sm text-zinc-900">{value && value.trim() ? value : "—"}</span>
    </div>
  );
}

function SkillGroup({ label, skills }: { label: string; skills: string[] }) {
  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 bg-white px-3 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      {skills.length ? (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100"
            >
              {skill}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-600">—</p>
      )}
    </div>
  );
}

function AmbiguityPanel({ response }: { response?: RuaAmbiguityFields | null }) {
  const { issues, hasSchemaFlags } = deriveAmbiguity(response);

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 ring-1 ring-amber-100">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-amber-900">Ambiguity &amp; conflicts</h3>
      </div>
      <div className="mt-2 space-y-2 text-sm text-amber-900">
        {issues.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5">
            {issues.map((issue, index) => (
              <li key={`${issue}-${index}`}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="text-amber-800">
            {hasSchemaFlags ? "No issues detected." : "This agent response does not include ambiguity flags yet."}
          </p>
        )}
      </div>
    </section>
  );
}

export function RuaTestClient({ agentsEnabled }: RuaTestClientProps) {
  const [jobText, setJobText] = useState<string>(
    "Acme Corp is hiring a Senior Backend Engineer.\nResponsibilities include building APIs in Node.js, working with PostgreSQL, and collaborating with product managers.\nThe role is hybrid in San Francisco and offers competitive benefits.",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RuaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<string>("manual");
  const [sourceTag, setSourceTag] = useState<string>("rua-test-page");
  const jsonRef = useRef<HTMLPreElement | null>(null);

  const summary = useMemo(() => summarizeRua(result?.rua ?? null), [result]);

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
        const message = typeof errorBody.error === "string" ? errorBody.error : `Request failed with status ${response.status}`;
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
    <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">ETE-013</p>
        <p className="text-sm text-slate-600">
          Paste a job description below and send it through the RUA agent. The response mirrors the JSON available via curl.
        </p>
        {!agentsEnabled && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Agents are disabled. Enable the Agents feature flag to run this workflow.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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
            <p className="text-xs text-zinc-500">• Used to differentiate intake paths in diagnostics and audits.</p>
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
            <p className="text-xs text-zinc-500">• Helps trace where this job text originated (ATS, intake, test).</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <button
            type="submit"
            disabled={loading || !agentsEnabled}
            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending to RUA…" : "Run RUA"}
          </button>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-zinc-500">Payload: &#123; recruiterId: "charlie", rawJobText &#125;</p>
            <p className="text-xs text-zinc-600">
              • RUA outputs feed scoring and matching. If role normalization looks wrong here, downstream rankings will degrade.
            </p>
          </div>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Error: {error}</div>
      )}

      {result && (
        <section className="mt-6 space-y-4 text-sm">
          <div className="space-y-3">
            <details className="group rounded-2xl border border-zinc-200 bg-zinc-50 p-4" open>
              <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-semibold text-zinc-900">
                <span>Normalized role summary</span>
                <button
                  type="button"
                  className="text-xs font-medium text-indigo-600 underline decoration-indigo-200 decoration-2 underline-offset-4 hover:text-indigo-500"
                  onClick={(event) => {
                    event.preventDefault();
                    jsonRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Jump to fields in JSON
                </button>
              </summary>

              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <SummaryItem label="Normalized title" value={summary?.title ?? null} />
                  <SummaryItem label="Level / seniority" value={summary?.level ?? null} />
                  <SummaryItem
                    label="Location / remote policy"
                    value={
                      summary
                        ? [summary.location, summary.remoteType].filter((value) => value && value.trim()).join(" • ") || null
                        : null
                    }
                  />
                  <SummaryItem label="Employment type" value={summary?.employmentType ?? null} />
                </div>

                <SkillGroup label="Must-have skills (top 12)" skills={summary?.mustHaveSkills ?? []} />
                <SkillGroup label="Nice-to-have skills (top 12)" skills={summary?.niceToHaveSkills ?? []} />

                <div className="space-y-2 rounded-lg border border-zinc-200 bg-white px-3 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Key responsibilities</div>
                  <p className="text-sm text-zinc-900">{summary?.responsibilities?.trim() || "—"}</p>
                </div>

                <div className="space-y-2 rounded-lg border border-zinc-200 bg-white px-3 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Required certifications</div>
                  <p className="text-sm text-zinc-900">—</p>
                </div>
              </div>
            </details>

            <AmbiguityPanel response={result.rua ?? null} />
          </div>

          <div className="space-y-2 text-sm">
            <h2 className="text-base font-semibold text-zinc-800">Response</h2>
            <pre
              ref={jsonRef}
              className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-800"
            >
              {JSON.stringify(result, null, 2)}
            </pre>
            <p className="text-zinc-600">
              Use <code>jobReqId</code> to find the record and <code>agentRunId</code> for the agent log.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
