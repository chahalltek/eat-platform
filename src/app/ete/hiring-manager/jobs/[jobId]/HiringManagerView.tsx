"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useState } from "react";

import { ClientActionLink } from "@/components/ClientActionLink";

export type ShortlistRunMeta = {
  runId: string;
  startedAt: string;
  finishedAt: string | null;
  shortlistedCount: number;
  totalMatches: number;
  strategy?: string;
};

export type ShortlistCandidate = {
  id: string;
  candidateId: string;
  name: string;
  channel: string;
  strengths: string[];
  weaknesses: string[];
  explanation: string;
  shortlisted: boolean;
  shortlistReason?: string | null;
  role?: string | null;
  location?: string | null;
  email?: string | null;
  score?: number | null;
};

type HiringManagerViewProps = {
  jobTitle: string;
  jobLocation?: string | null;
  jobId: string;
  customerName: string;
  summary?: string | null;
  shortlist: ShortlistCandidate[];
  shortlistMeta: ShortlistRunMeta | null;
  requiredSkills: string[];
};

export function HiringManagerView({
  jobTitle,
  jobLocation,
  jobId,
  customerName,
  summary,
  shortlist,
  shortlistMeta,
  requiredSkills,
}: HiringManagerViewProps) {
  const [selected, setSelected] = useState<ShortlistCandidate | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const shortlisted = useMemo(() => shortlist.filter((entry) => entry.shortlisted), [shortlist]);
  const passed = shortlisted.length;
  const failed = shortlist.length - shortlisted.length;
  const justificationPreview = useMemo(
    () => (selected ? buildJustification(selected) : ""),
    [selected]
  );

  useEffect(() => {
    setCopyStatus("idle");
  }, [selected]);

  function confidenceBand(score?: number | null): string {
    if (typeof score !== "number") return "Confidence: Not captured";
    if (score >= 80) return "Confidence: High";
    if (score >= 60) return "Confidence: Medium";
    return "Confidence: Low";
  }

  function buildJustification(candidate: ShortlistCandidate): string {
    const strengths = candidate.strengths.slice(0, 3);
    const risks = candidate.weaknesses.slice(0, 2);

    const summary =
      candidate.explanation && candidate.explanation.trim().length > 0
        ? candidate.explanation
        : "No explanation captured.";

    const parts: string[] = [];
    parts.push(
      `${candidate.name} — ${candidate.role ?? "Role not captured"} for ${jobTitle}` +
        `${jobLocation ? ` (${jobLocation})` : ""}. ${summary}`
    );

    if (candidate.shortlistReason) {
      parts.push(`Shortlist reason: ${candidate.shortlistReason}`);
    }

    parts.push("Top strengths:");
    strengths.forEach((strength, index) => {
      parts.push(`${index + 1}. ${strength}`);
    });

    parts.push("Risks / watchouts:");
    risks.forEach((risk, index) => {
      parts.push(`${index + 1}. ${risk}`);
    });

    parts.push(confidenceBand(candidate.score));

    return parts.join("\n");
  }

  async function handleCopyJustification(candidate: ShortlistCandidate) {
    setCopyStatus("idle");

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API not available");
      }

      const justification = buildJustification(candidate);
      await navigator.clipboard.writeText(justification);
      setCopyStatus("copied");
    } catch (error) {
      console.error("Failed to copy justification", error);
      setCopyStatus("error");
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Hiring Manager</p>
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">{jobTitle}</h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {customerName ? `${customerName} • ` : ""}
              {jobLocation ?? "Location not provided"}
            </p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Read-only shortlist view. No agent controls or reruns are available in this mode.
            </p>
          </div>
          <ClientActionLink href="/ete/jobs">Back to ETE Home</ClientActionLink>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-900/60">
            <p className="text-xs uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Job</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{jobId}</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Persisted summary from intake form.</p>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-900/60">
            <p className="text-xs uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Shortlist run</p>
            {shortlistMeta ? (
              <div className="space-y-1 text-sm text-zinc-800 dark:text-zinc-100">
                <p className="font-semibold">{shortlistMeta.shortlistedCount} shortlisted of {shortlistMeta.totalMatches || shortlist.length} matches</p>
                <p className="text-zinc-600 dark:text-zinc-300">
                  Started {formatDistanceToNow(new Date(shortlistMeta.startedAt), { addSuffix: true })}
                  {shortlistMeta.finishedAt
                    ? ` • Completed ${formatDistanceToNow(new Date(shortlistMeta.finishedAt), { addSuffix: true })}`
                    : ""}
                </p>
                {shortlistMeta.strategy ? (
                  <p className="text-xs uppercase tracking-[0.12em] text-indigo-700 dark:text-indigo-300">Strategy: {shortlistMeta.strategy}</p>
                ) : null}
                <p className="text-[11px] text-zinc-500">Run ID: {shortlistMeta.runId}</p>
              </div>
            ) : (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">No shortlist run metadata found. Showing latest stored shortlist state.</p>
            )}
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-900/60">
            <p className="text-xs uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Outcome</p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-100 dark:ring-emerald-800/60">
                Pass: {passed}
              </span>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-800 ring-1 ring-rose-100 dark:bg-rose-900/40 dark:text-rose-100 dark:ring-rose-800/60">
                Fail: {failed}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">Pass/fail comes from stored shortlist state; reruns are disabled here.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-900/60">
          <p className="text-xs uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Role overview</p>
          <p className="mt-2 whitespace-pre-line text-sm text-zinc-800 dark:text-zinc-100">{summary || "No intake summary available."}</p>
          {requiredSkills.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {requiredSkills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-100 dark:ring-indigo-800/60"
                >
                  Must-have: {skill}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <section className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Shortlist</p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Read-only shortlist with explanations</h2>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Persisted output from shortlist agent; explanations are streamlined.</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-100 dark:ring-indigo-800/60">
            View only
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-indigo-100/70 bg-white/70 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-950/40">
          <table className="min-w-full divide-y divide-indigo-100 text-sm">
            <thead className="bg-indigo-50/80 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">Candidate</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">Channel</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">Top strengths</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">Explanation</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">Pass/Fail</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-100/80 dark:divide-indigo-800/60">
              {shortlist.map((candidate) => (
                <tr key={candidate.id} className="bg-white/70 text-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100">
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-50">{candidate.name}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-300">{candidate.role ?? "Role not captured"}</div>
                      <div className="text-[11px] text-zinc-500">{candidate.email ?? "No email"}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">{candidate.channel}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">
                    <ul className="list-disc space-y-1 pl-4">
                      {candidate.strengths.map((strength) => (
                        <li key={`${candidate.id}-${strength}`}>{strength}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">
                    <p className="line-clamp-3 text-sm leading-relaxed">{candidate.explanation}</p>
                    {candidate.shortlistReason ? (
                      <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-indigo-700 dark:text-indigo-300">
                        {candidate.shortlistReason}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {candidate.shortlisted ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-100 dark:ring-emerald-800/60">
                        Pass
                      </span>
                    ) : (
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-rose-800 ring-1 ring-rose-100 dark:bg-rose-900/40 dark:text-rose-100 dark:ring-rose-800/60">
                        Fail
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-xs font-semibold text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-100"
                      onClick={() => setSelected(candidate)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-300">
          Uses persisted shortlist records and the latest shortlist run metadata. Agents and reruns are intentionally hidden in Hiring Manager mode.
        </p>
      </section>

      {selected ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-indigo-100 bg-white p-6 shadow-xl dark:border-indigo-800/60 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Candidate</p>
                <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{selected.name}</h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{selected.role ?? "Role not captured"}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{selected.location ?? "Location not provided"}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{selected.email ?? "No email"}</p>
              </div>
              <button
                type="button"
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm dark:border-indigo-800/60 dark:bg-indigo-900/40">
                <p className="text-xs uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-200">Top strengths</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-indigo-900 dark:text-indigo-100">
                  {selected.strengths.map((strength) => (
                    <li key={`${selected.id}-strength-${strength}`}>{strength}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 shadow-sm dark:border-amber-800/60 dark:bg-amber-900/40">
                <p className="text-xs uppercase tracking-[0.14em] text-amber-800 dark:text-amber-100">Weaknesses / risks</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-amber-900 dark:text-amber-100">
                  {selected.weaknesses.map((weakness) => (
                    <li key={`${selected.id}-weakness-${weakness}`}>{weakness}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-950/40">
              <p className="text-xs uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-200">Explanation</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">{selected.explanation}</p>
              {selected.shortlistReason ? (
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700 dark:text-indigo-300">
                  Shortlist reason: {selected.shortlistReason}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">Pass/fail is derived from stored shortlist records; actions are disabled.</p>
            </div>

            <div className="mt-4 space-y-3 rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-950/40">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-200">HM-ready justification</p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-200">
                    Summary paragraph, strengths, risks, and confidence for copy/paste.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => selected && handleCopyJustification(selected)}
                    disabled={!selected.shortlisted}
                    className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm ring-1 ring-indigo-500 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {copyStatus === "copied" ? "Copied" : "Copy justification"}
                  </button>
                  <button
                    type="button"
                    disabled
                    className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 dark:bg-zinc-900 dark:text-indigo-200 dark:ring-indigo-700/60"
                  >
                    PDF export (coming soon)
                  </button>
                </div>
              </div>

              <pre className="whitespace-pre-wrap rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-sm text-zinc-800 dark:border-indigo-800/60 dark:bg-indigo-900/30 dark:text-zinc-100">{justificationPreview}</pre>
              {copyStatus === "error" ? (
                <p className="text-xs text-rose-600 dark:text-rose-400">Could not access clipboard. Try again or paste manually.</p>
              ) : null}
              {!selected.shortlisted ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">Justification is available for shortlisted candidates only.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
