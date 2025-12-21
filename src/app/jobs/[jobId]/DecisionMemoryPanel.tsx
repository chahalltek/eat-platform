"use client";

import { useMemo, useState } from "react";

import type { DecisionDto, DecisionPayload } from "@/server/decision/decisionDrafts";

type Props = {
  jobId: string;
  decisions: DecisionDto[];
  canCreate: boolean;
  canPublish: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function describeShortlist(payload: DecisionPayload) {
  if (!payload.shortlist.length) return "No shortlist captured yet.";
  const names = payload.shortlist.map((candidate) => candidate.name ?? candidate.candidateId);
  return names.join(", ");
}

function DecisionCard({ decision }: { decision: DecisionDto }) {
  const shortlistLabel = describeShortlist(decision.payload);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              decision.status === "PUBLISHED"
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {decision.status === "PUBLISHED" ? "Published" : "Draft"}
          </span>
          <p className="text-sm text-slate-600">Created {formatDate(decision.createdAt)}</p>
        </div>
        <p className="text-xs text-slate-500">Decision #{decision.id.slice(0, 8)}</p>
      </div>

      <div className="mt-3 space-y-2 text-sm text-slate-700">
        <div>
          <p className="font-semibold text-slate-900">Shortlist</p>
          <p>{shortlistLabel}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">Agent snapshot</p>
          <ul className="list-disc space-y-1 pl-5">
            {decision.payload.agentOutputs.shortlistDigest.length ? (
              decision.payload.agentOutputs.shortlistDigest.map((entry) => (
                <li key={entry}>{entry}</li>
              ))
            ) : (
              <li className="list-none text-slate-500">No agent outputs recorded.</li>
            )}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-slate-900">Rationale</p>
          <p className="text-slate-600">
            {decision.payload.rationale.decision || "Rationale pending"}
          </p>
        </div>
        <div className="flex gap-4 text-xs text-slate-500">
          <span>Updated {formatDate(decision.updatedAt)}</span>
          <span>Published {formatDate(decision.publishedAt)}</span>
        </div>
      </div>
    </div>
  );
}

export function DecisionMemoryPanel({ jobId, decisions, canCreate, canPublish }: Props) {
  const [entries, setEntries] = useState<DecisionDto[]>(() => [...decisions]);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [entries],
  );

  const latestDraft = useMemo(
    () => sortedEntries.find((entry) => entry.status === "DRAFT") ?? null,
    [sortedEntries],
  );
  const latestPublished = useMemo(() => {
    const published = sortedEntries.filter((entry) => entry.status === "PUBLISHED");
    if (!published.length) return null;

    return published.sort(
      (a, b) => new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime(),
    )[0];
  }, [sortedEntries]);

  async function handleCreate() {
    setError(null);
    setIsCreating(true);
    try {
      const response = await fetch("/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body?.error ?? "Unable to create draft");
        return;
      }

      if (body?.decision) {
        setEntries((prev) => [body.decision as DecisionDto, ...prev.filter((entry) => entry.id !== body.decision.id)]);
      }
    } catch (err) {
      console.error("Failed to create decision draft", err);
      setError("Unable to create draft");
    } finally {
      setIsCreating(false);
    }
  }

  async function handlePublish() {
    if (!latestDraft) return;
    setError(null);
    setPublishingId(latestDraft.id);
    try {
      const response = await fetch(`/api/decisions/${latestDraft.id}/publish`, { method: "POST" });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body?.error ?? "Unable to publish decision");
        return;
      }

      if (body?.decision) {
        setEntries((prev) =>
          prev.map((entry) => (entry.id === body.decision.id ? (body.decision as DecisionDto) : entry)),
        );
      }
    } catch (err) {
      console.error("Failed to publish decision", err);
      setError("Unable to publish decision");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Decision Memory</p>
          <h2 className="text-xl font-semibold text-slate-900">Drafts and published decisions</h2>
          <p className="text-sm text-slate-700">
            Capture the shortlist snapshot and publish when it is ready to share.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate || isCreating}
            className={`rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition ${
              !canCreate || isCreating ? "cursor-not-allowed opacity-60" : "hover:bg-indigo-700"
            }`}
          >
            {isCreating ? "Creating..." : "Create draft"}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!canPublish || !latestDraft || Boolean(publishingId)}
            className={`rounded-md px-3 py-2 text-sm font-semibold shadow-sm transition ${
              !canPublish || !latestDraft
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
            aria-disabled={!canPublish || !latestDraft}
          >
            {publishingId ? "Publishing..." : "Publish draft"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-white/60 bg-white/70 p-4 lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Latest published</p>
          {latestPublished ? (
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Published {formatDate(latestPublished.publishedAt)}</p>
              <p>{describeShortlist(latestPublished.payload)}</p>
              <p className="text-xs text-slate-500">Decision #{latestPublished.id.slice(0, 8)}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No published decisions yet.</p>
          )}
        </div>
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">All drafts and decisions</p>
            <p className="text-xs text-slate-500">
              Drafts: {entries.filter((entry) => entry.status === "DRAFT").length} • Published:{" "}
              {entries.filter((entry) => entry.status === "PUBLISHED").length}
            </p>
          </div>
          {sortedEntries.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {sortedEntries.map((decision) => (
                <DecisionCard key={decision.id} decision={decision} />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-slate-200 bg-white/60 p-4 text-sm text-slate-600">
              No decisions yet. Create a draft to capture the current shortlist.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
