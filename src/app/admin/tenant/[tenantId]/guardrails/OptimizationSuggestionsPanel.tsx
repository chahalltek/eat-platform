"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowPathIcon, CheckCircleIcon, ShieldExclamationIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { SparklesIcon } from "@heroicons/react/24/solid";

type Recommendation = {
  id: string;
  title: string;
  summary: string;
  rationale: string;
  suggestedChange: string;
  confidence: "low" | "medium" | "high";
  signals: string[];
  status: "pending" | "applied" | "dismissed";
};

async function parseJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch (error) {
    console.warn("Failed to parse guardrail recommendation response", error);
    return null;
  }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const data = payload as { error?: unknown; message?: unknown };
    if (typeof data.message === "string") return data.message;

    if (typeof data.error === "string") return data.error;

    if (data.error && typeof data.error === "object" && typeof (data.error as { message?: unknown }).message === "string") {
      return (data.error as { message: string }).message;
    }
  }

  return fallback;
}

function StatusBadge({ status }: { status: Recommendation["status"] }) {
  const variants: Record<Recommendation["status"], string> = {
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    applied: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dismissed: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  };

  const labels: Record<Recommendation["status"], string> = {
    pending: "Action needed",
    applied: "Approved",
    dismissed: "Dismissed",
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ring-1 ${variants[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {labels[status]}
    </span>
  );
}

export function OptimizationSuggestionsPanel({ tenantId }: { tenantId: string }) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tenant/${encodeURIComponent(tenantId)}/guardrails/recommendations`);
      const body = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(getErrorMessage(body, "Unable to load suggestions"));
      }

      if (!body || typeof body !== "object") {
        throw new Error("Unable to load suggestions");
      }

      const payload = body as { recommendations?: Recommendation[] };
      setRecommendations(payload.recommendations ?? []);
    } catch (loadError) {
      const message = (loadError as Error).message || "Failed to load suggestions";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  async function handleAction(recommendationId: string, action: "approve" | "dismiss") {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tenant/${encodeURIComponent(tenantId)}/guardrails/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId, action }),
      });

      const body = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(getErrorMessage(body, "Unable to update recommendation"));
      }

      if (!body || typeof body !== "object") {
        throw new Error("Unable to update recommendation");
      }

      const payload = body as { recommendations?: Recommendation[] };
      setRecommendations(payload.recommendations ?? []);
    } catch (submitError) {
      const message = (submitError as Error).message || "Unable to update recommendation";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-indigo-100 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-indigo-50 px-6 py-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Optimization</p>
          <div className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
            <SparklesIcon className="h-5 w-5 text-indigo-500" aria-hidden />
            <span>Optimization suggestions</span>
          </div>
          <p className="text-sm text-zinc-600">
            ETE reviews MQI trends, candidate feedback, and confidence bands to suggest safer guardrail values.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadRecommendations()}
          className="inline-flex items-center gap-2 rounded-full border border-indigo-100 px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-3 px-6 py-4 text-sm text-amber-800">
          <ShieldExclamationIcon className="h-5 w-5 text-amber-500" aria-hidden />
          <div>
            <p className="font-semibold">Unable to load suggestions</p>
            <p className="text-xs text-amber-700">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="divide-y divide-indigo-50">
        {loading ? (
          <div className="px-6 py-8 text-sm text-zinc-500">Loading guardrail recommendations…</div>
        ) : recommendations.length === 0 ? (
          <div className="flex items-center gap-3 px-6 py-6 text-sm text-zinc-600">
            <CheckCircleIcon className="h-5 w-5 text-emerald-500" aria-hidden />
            <p>Everything looks tuned. No suggestions right now.</p>
          </div>
        ) : (
          recommendations.map((recommendation) => (
            <article key={recommendation.id} className="flex flex-col gap-3 px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-zinc-900">{recommendation.title}</h3>
                    <StatusBadge status={recommendation.status} />
                  </div>
                  <p className="text-sm text-zinc-700">{recommendation.summary}</p>
                </div>
                <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                  {recommendation.confidence} confidence
                </span>
              </div>

              <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
                <p className="font-semibold text-zinc-900">Suggested change</p>
                <p className="text-sm text-zinc-700">{recommendation.suggestedChange}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                <span className="font-semibold text-zinc-800">Why:</span>
                <span>{recommendation.rationale}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {recommendation.signals.map((signal) => (
                  <span key={signal} className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700 ring-1 ring-zinc-200">
                    {signal}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleAction(recommendation.id, "approve")}
                  disabled={submitting || recommendation.status === "applied"}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <CheckCircleIcon className="h-5 w-5" aria-hidden /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => void handleAction(recommendation.id, "dismiss")}
                  disabled={submitting || recommendation.status === "dismissed"}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-amber-200 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <XCircleIcon className="h-5 w-5" aria-hidden /> Dismiss
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

