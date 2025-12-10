"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { BackToConsoleButton } from "@/components/BackToConsoleButton";
import { CandidateTable, type CandidateRow } from "./CandidateTable";
import { EATClientLayout } from "@/components/EATClientLayout";

export const dynamic = "force-dynamic";

type CandidateLoadError = {
  type: "forbidden" | "server" | "network";
  status?: number;
  message?: string;
};

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [error, setError] = useState<CandidateLoadError | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const isDevMode = useMemo(() => process.env.NODE_ENV !== "production", []);

  const loadCandidates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/candidates", { cache: "no-store" });

      if (response.status === 401 || response.status === 403) {
        setError({ type: "forbidden", status: response.status });
        setCandidates([]);
        return;
      }

      if (!response.ok) {
        const details = await response.json().catch(() => null);
        setError({ type: "server", status: response.status, message: details?.error });
        setCandidates([]);
        return;
      }

      const payload = await response.json();
      const rows = Array.isArray(payload.candidates) ? payload.candidates : [];
      setCandidates(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError({ type: "network", message });
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const errorContent = useMemo(() => {
    if (!error) return null;

    if (error.type === "forbidden") {
      return {
        title: "Access denied",
        description: "You do not have permission to view candidates for this workspace.",
      };
    }

    const base = {
      title: "Unable to load candidates",
      description: "Something went wrong while loading candidate records. Try again or contact support.",
    };

    return {
      ...base,
      status: error.status,
      details: isDevMode ? error.message : undefined,
    };
  }, [error, isDevMode]);

  const emptyState = (
    <div className="py-6 text-center text-sm text-slate-600">
      <div className="text-base font-semibold text-slate-800">No candidates yet</div>
      <div className="mt-1 text-sm text-slate-500">Upload resumes to get started.</div>
    </div>
  );

  return (
    <EATClientLayout>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Candidates</h1>
          <p className="text-sm text-gray-600">Search, sort, and browse recent candidates.</p>
        </div>
        <BackToConsoleButton />
      </div>

      {isLoading ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          Loading candidates...
        </div>
      ) : null}

      {errorContent ? (
        <div className="mt-4 space-y-2 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="font-semibold text-rose-800">{errorContent.title}</div>
          <div className="text-sm text-rose-700">{errorContent.description}</div>
          {errorContent.status ? (
            <div className="text-xs text-rose-700">Status code: {errorContent.status}</div>
          ) : null}
          {errorContent.details ? (
            <div className="text-xs text-rose-700">Details: {errorContent.details}</div>
          ) : null}
          <button
            type="button"
            onClick={loadCandidates}
            className="mt-2 inline-flex items-center rounded-md border border-rose-300 bg-white px-3 py-1 text-xs font-medium text-rose-800 shadow-sm transition hover:border-rose-400 hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!errorContent ? <CandidateTable candidates={candidates} emptyState={emptyState} /> : null}
    </EATClientLayout>
  );
}
