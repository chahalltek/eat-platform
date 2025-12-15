"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { BackToConsoleButton } from "@/components/BackToConsoleButton";
import { CandidateTable, type CandidateRow } from "./CandidateTable";

type CandidateLoadError = {
  type: "forbidden" | "server" | "network";
  status?: number;
  message?: string;
};

export function CandidatesClient() {
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
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError({ type: "network", message });
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  type ErrorContent = {
    title: string;
    description: string;
    status?: number;
    details?: string;
  };

  const errorContent = useMemo<ErrorContent | null>(() => {
    if (!error) return null;

    if (error.type === "forbidden") {
      return {
        title: "Access denied",
        description: "You do not have permission to view candidates for this workspace.",
        status: undefined,
        details: undefined,
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
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Candidates</h1>
          <p className="text-sm text-slate-500">Search, sort, and browse recent candidates.</p>
        </div>
        <BackToConsoleButton />
      </div>

      {isLoading ? (
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          Loading candidates...
        </div>
      ) : null}

      {errorContent ? (
        <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="font-semibold text-rose-800">{errorContent.title}</div>
          <div className="text-sm text-rose-700">{errorContent.description}</div>
          {errorContent.status ? (
            <div className="text-xs text-rose-700">Status code: {errorContent.status}</div>
          ) : null}
          {errorContent.details ? <div className="text-xs text-rose-700">{errorContent.details}</div> : null}
        </div>
      ) : null}

      {!isLoading && !errorContent && candidates.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white p-8 shadow-sm">
          {emptyState}
        </div>
      ) : null}

       {!errorContent && candidates.length > 0 ? (
        <CandidateTable candidates={candidates} />
      ) : null}
    </>
  );
}

export default CandidatesClient;
