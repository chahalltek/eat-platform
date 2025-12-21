"use client";

import { useMemo, useState } from "react";

import { normalizeMatchExplanation } from "@/lib/matching/explanation";
import { type JobCandidateStatus } from "@/lib/jobs/status";

import type { MatchRow } from "./JobMatchesTable";

type Props = {
  jobId: string;
  jobTitle: string;
  matches: MatchRow[];
  canExportDecisions: boolean;
};

type CopyState = "idle" | "success" | "error";
type ExportState = "idle" | "loading" | "success" | "error";

type ShortlistExportRow = {
  name: string;
  title: string;
  strengths: string[];
  risks: string[];
  confidence: string;
};

const SHORTLISTED_STATUS: JobCandidateStatus = "SHORTLISTED";
const SHORTLIST_COLUMNS = ["Name", "Title", "Key strengths", "Risks", "Confidence"] as const;

function normalizePercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  const normalized = value > 1 ? value : value * 100;
  return `${Math.round(normalized)}%`;
}

function formatList(values: string[], fallback: string, limit = 3) {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return [fallback];
  }

  return Array.from(new Set(normalized)).slice(0, limit);
}

function formatConfidence(match: MatchRow) {
  const score = normalizePercent(match.confidenceScore);
  const category = match.confidenceCategory ?? null;

  if (score === "—" && !category) return "—";
  if (category) return `${score} (${category})`;
  return score;
}

function extractReasonList(explanation: unknown, key: "topReasons" | "riskAreas") {
  if (explanation && typeof explanation === "object" && Array.isArray((explanation as Record<string, unknown>)[key])) {
    return ((explanation as Record<string, unknown>)[key] as unknown[])
      .map((entry) => (typeof entry === "string" ? entry : String(entry)))
      .filter(Boolean);
  }

  return null;
}

export function buildShortlistRows(matches: MatchRow[]): ShortlistExportRow[] {
  return matches.map((match) => {
    const explanation = normalizeMatchExplanation(match.explanation);
    const explicitTopReasons = extractReasonList(match.explanation, "topReasons");
    const explicitRiskAreas = extractReasonList(match.explanation, "riskAreas");
    const strengths = formatList(
      [...(explicitTopReasons ?? explanation.topReasons), ...(match.keySkills ?? []).map((skill) => `${skill} coverage`)],
      "Key strengths not captured yet.",
    );
    const risks = formatList(explicitRiskAreas ?? explanation.riskAreas, "No risks recorded yet.");

    return {
      name: match.candidateName ?? "Name not provided",
      title: match.currentTitle ?? match.jobTitle ?? "—",
      strengths,
      risks,
      confidence: formatConfidence(match),
    };
  });
}

export function buildShortlistClipboard(jobTitle: string, jobId: string, rows: ShortlistExportRow[]) {
  const lines: string[] = [];
  lines.push(`Shortlist export for ${jobTitle} (${jobId})`);
  lines.push(`Total shortlisted: ${rows.length}`);
  lines.push("");
  lines.push(`| ${SHORTLIST_COLUMNS.join(" | ")} |`);
  lines.push(`| ${SHORTLIST_COLUMNS.map(() => "---").join(" | ")} |`);
  for (const row of rows) {
    lines.push(
      `| ${row.name} | ${row.title} | ${row.strengths.join("; ")} | ${row.risks.join("; ")} | ${row.confidence} |`,
    );
  }
  lines.push("");
  lines.push("_Generated via decision.export access for recruiting._");

  return lines.join("\n");
}

export function buildShortlistCsv(rows: ShortlistExportRow[]) {
  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

  const csvLines = [
    SHORTLIST_COLUMNS.map(escapeCsv).join(","),
    ...rows.map((row) =>
      [
        row.name,
        row.title,
        row.strengths.join("; "),
        row.risks.join("; "),
        row.confidence,
      ].map(escapeCsv).join(","),
    ),
  ];

  return csvLines.join("\r\n");
}

export function ShortlistActions({ jobId, jobTitle, matches, canExportDecisions }: Props) {
  const shortlisted = useMemo(
    () =>
      matches.filter((match) => match.shortlisted ?? match.jobCandidateStatus === SHORTLISTED_STATUS).map((match) => ({
        ...match,
        confidenceBand: match.confidenceCategory ?? null,
      })),
    [matches],
  );
  const shortlistRows = useMemo(() => buildShortlistRows(shortlisted), [shortlisted]);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [exportState, setExportState] = useState<ExportState>("idle");

  const exportsBlocked = shortlistRows.length === 0 || !canExportDecisions;

  async function handleDownloadCsv() {
    setExportState("loading");

    if (exportsBlocked) {
      setExportState("error");
      return;
    }

    const csvContent = buildShortlistCsv(shortlistRows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shortlist_${jobId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportState("success");
  }

  async function handleCopyShortlist() {
    setCopyState("idle");

    if (exportsBlocked || !navigator?.clipboard?.writeText) {
      setCopyState("error");
      return;
    }

    const payload = buildShortlistClipboard(jobTitle, jobId, shortlistRows);

    try {
      await navigator.clipboard.writeText(payload);
      setCopyState("success");
    } catch (error) {
      console.error("Failed to copy shortlist", error);
      setCopyState("error");
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1 text-sm text-gray-700">
        <div>
          Shortlisted candidates: <span className="font-semibold">{shortlistRows.length}</span>
        </div>
        <p className="text-xs text-gray-600">
          {canExportDecisions
            ? "Copy an email-ready table or download a CSV with strengths, risks, and confidence."
            : "decision.export is required to copy or download. Sourcers can still view the shortlist."}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleCopyShortlist}
          disabled={exportsBlocked}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {copyState === "success" ? "Copied" : copyState === "error" ? "Copy unavailable" : "Copy to clipboard"}
        </button>
        <button
          type="button"
          onClick={handleDownloadCsv}
          disabled={exportsBlocked || exportState === "loading"}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {exportState === "loading" ? "Preparing…" : exportState === "error" ? "Download blocked" : "Download CSV"}
        </button>
      </div>
    </div>
  );
}
