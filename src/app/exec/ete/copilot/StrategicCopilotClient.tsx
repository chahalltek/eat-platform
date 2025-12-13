"use client";

import { useMemo, useState, type FormEvent } from "react";

import type { CopilotResponse } from "@/lib/copilot/strategicCopilot";

type Message = { role: "user" | "copilot"; content: string; response?: CopilotResponse };

function confidenceBadge(confidence: CopilotResponse["confidence"]) {
  const styles: Record<CopilotResponse["confidence"], string> = {
    high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    low: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles[confidence]}`}>
      Confidence: {confidence}
    </span>
  );
}

function evidenceLink(type: string, id?: string) {
  switch (type) {
    case "benchmark":
      return "/admin/ete/insights";
    case "forecast":
      return "/ete/forecast/time-to-fill";
    case "market_signal":
    case "mqi":
    case "l2_result":
      return "/admin/ete/learning";
    default:
      return id ? `#${id}` : "#";
  }
}

export function StrategicCopilotClient({
  tenantId,
  userLabel,
}: {
  tenantId: string;
  userLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [roleFamily, setRoleFamily] = useState("");
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(30);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeholder = useMemo(
    () =>
      "Ask about market risks, forecasted fill times, or how benchmarks look for a given role family.",
    [],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError("Enter a question to get started.");
      return;
    }

    setLoading(true);
    setError(null);

    const scope = {
      roleFamily: roleFamily.trim() || undefined,
      horizonDays,
    };

    try {
      const response = await fetch("/api/ete/copilot/strategic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery, scope, tenantId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "The copilot is unavailable right now.");
        setLoading(false);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmedQuery },
        { role: "copilot", content: payload.answer as string, response: payload as CopilotResponse },
      ]);
      setQuery("");
    } catch {
      setError("Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <form onSubmit={handleSubmit} className="border-b border-slate-100 bg-slate-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-800/60">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
              Question
            </label>
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              rows={3}
            />
          </div>
          <div className="w-full md:w-64">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
              Role family (optional)
            </label>
            <input
              value={roleFamily}
              onChange={(event) => setRoleFamily(event.target.value)}
              placeholder="e.g. Account Executive"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
              Horizon
            </label>
            <select
              value={horizonDays}
              onChange={(event) => setHorizonDays(Number(event.target.value) as 30 | 60 | 90)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          <div className="flex w-full md:w-auto md:flex-none md:justify-end">
            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-400"
            >
              {loading ? "Generating..." : "Ask copilot"}
            </button>
          </div>
        </div>
        {error ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
      </form>

      <div className="space-y-4 p-4">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300">
            Ask a question to get started. The copilot will cite ETE evidence with every answer.
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-xl border p-4 shadow-sm ${
                message.role === "user"
                  ? "border-indigo-100 bg-indigo-50/70 text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950"
                  : "border-slate-200 bg-white text-slate-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
                {message.role === "user" ? userLabel : "Copilot"}
                <span className="h-1 w-1 rounded-full bg-slate-400" aria-hidden />
                {message.role === "user" ? "Question" : "Response"}
              </div>
              <p className="mt-2 text-sm leading-relaxed">{message.content}</p>
              {message.response ? (
                <div className="mt-3 space-y-3 text-sm">
                  <div>{confidenceBadge(message.response.confidence)}</div>
                  <ul className="list-disc space-y-1 pl-5 text-slate-700 dark:text-zinc-200">
                    {message.response.bullets.map((bullet, idx) => (
                      <li key={`${message.role}-bullet-${idx}`}>{bullet}</li>
                    ))}
                  </ul>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
                      Evidence
                    </p>
                    <ul className="mt-2 space-y-2">
                      {message.response.evidence.map((item) => (
                        <li key={`${item.type}-${item.id ?? item.label}`} className="text-sm text-indigo-700 dark:text-indigo-200">
                          <a href={evidenceLink(item.type, item.id)} className="underline" target="_blank" rel="noreferrer">
                            {item.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                    {message.response.caveats.length > 0 ? (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em]">Caveats</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                          {message.response.caveats.map((caveat, idx) => (
                            <li key={`caveat-${idx}`}>{caveat}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
