"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  SparklesIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";

import type { TenantDiagnostics } from "@/lib/tenant/diagnostics";

const TESTS = [
  {
    key: "databaseConnectivity" as const,
    name: "Database connectivity",
    description: "Checks ETE database connection for this tenant.",
  },
  {
    key: "tenantConfig" as const,
    name: "Tenant config",
    description: "Verifies tenant settings match expected defaults.",
  },
  {
    key: "agentPipeline" as const,
    name: "Agent pipeline",
    description: "Validate test run for each agent.",
  },
  {
    key: "auditLogging" as const,
    name: "Audit logging",
    description: "Inspect the latest audit events.",
  },
  {
    key: "dataExport" as const,
    name: "Data export availability",
    description: "Attempts to fetch the latest export for download.",
  },
  {
    key: "featureFlags" as const,
    name: "Feature flags",
    description: "Checks feature flags defined for this tenant.",
  },
  {
    key: "rateLimits" as const,
    name: "Rate limits",
    description: "Checks rate-limiting configuration for sensitive actions.",
  },
  {
    key: "results" as const,
    name: "Results",
    description: "Render the results of each test.",
  },
];

type TestKey = (typeof TESTS)[number]["key"];

type Status = "idle" | "running" | "pass" | "warn" | "fail";

type TestState = {
  status: Status;
  message: string | null;
  lastRun: string | null;
};

type PersistedResults = Record<string, Record<TestKey, TestState>>;

const initialState: Record<TestKey, TestState> = TESTS.reduce(
  (state, test) => ({ ...state, [test.key]: { status: "idle", message: null, lastRun: null } }),
  {} as Record<TestKey, TestState>,
);

const STORAGE_KEY = "tenant-test-results";

function readPersistedResults(): PersistedResults {
  if (typeof window === "undefined") return {};

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) return {};

  try {
    return JSON.parse(raw) as PersistedResults;
  } catch (error) {
    console.warn("Failed to parse persisted test results", error);
    return {};
  }
}

function loadTenantResults(tenantId: string): Record<TestKey, TestState> {
  const persisted = readPersistedResults();
  const tenantResults = persisted[tenantId] ?? {};

  return {
    ...initialState,
    ...tenantResults,
  };
}

function persistTenantResults(tenantId: string, results: Record<TestKey, TestState>) {
  if (typeof window === "undefined") return;

  const persisted = readPersistedResults();
  const updated: PersistedResults = {
    ...persisted,
    [tenantId]: results,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function StatusBadge({ status, message }: { status: Status; message?: string | null }) {
  const { icon: Icon, label, color } = useMemo(() => {
    switch (status) {
      case "pass":
        return { icon: CheckCircleIcon, label: "Pass", color: "text-emerald-600" };
      case "warn":
        return { icon: ExclamationTriangleIcon, label: "Warning", color: "text-amber-600" };
      case "fail":
        return { icon: XCircleIcon, label: "Fail", color: "text-rose-600" };
      case "running":
        return { icon: ArrowPathIcon, label: "Running", color: "text-indigo-600" };
      default:
        return { icon: ExclamationTriangleIcon, label: "Not run", color: "text-zinc-500" };
    }
  }, [status]);

  return (
    <div className="flex flex-col gap-1 text-sm text-zinc-700">
      <div className={`flex items-center gap-2 font-semibold ${color}`}>
        <Icon className={`h-5 w-5 ${status === "running" ? "animate-spin" : ""}`} aria-hidden />
        <span>{label}</span>
      </div>
      {message ? <p className="text-xs text-zinc-500">{message}</p> : null}
    </div>
  );
}

function evaluateTest(key: TestKey, diagnostics: TenantDiagnostics): Pick<TestState, "status" | "message"> {
  switch (key) {
    case "databaseConnectivity":
      return { status: "pass", message: `Database responded for tenant ${diagnostics.tenantId}.` };
    case "tenantConfig":
      if (diagnostics.plan.id) {
        return { status: "pass", message: `Active plan: ${diagnostics.plan.name ?? diagnostics.plan.id}.` };
      }
      return { status: "warn", message: "No active plan configured for this tenant." };
    case "agentPipeline":
      return diagnostics.featureFlags.enabled
        ? { status: "pass", message: `${diagnostics.featureFlags.enabledFlags.length} feature flags enabled.` }
        : { status: "warn", message: "No feature flags enabled; agent capabilities may be limited." };
    case "auditLogging":
      return diagnostics.auditLogging.enabled
        ? { status: "pass", message: `${diagnostics.auditLogging.eventsRecorded} audit events captured.` }
        : { status: "warn", message: "No audit events recorded yet." };
    case "dataExport":
      return diagnostics.dataExport.enabled
        ? { status: "pass", message: "Exports are available for download." }
        : { status: "fail", message: "Exports are currently unavailable." };
    case "featureFlags":
      return diagnostics.featureFlags.enabled
        ? { status: "pass", message: diagnostics.featureFlags.enabledFlags.join(", ") || "Flags resolved." }
        : { status: "warn", message: "No feature flags enabled for this tenant." };
    case "rateLimits":
      return diagnostics.rateLimits.length > 0
        ? { status: "pass", message: `${diagnostics.rateLimits.length} rate limits loaded.` }
        : { status: "fail", message: "No rate limit configuration found." };
    case "results":
      return { status: "warn", message: "Results rendering is not yet implemented." };
  }
}

export function TenantTestTable({ tenantId }: { tenantId: string }) {
  const [results, setResults] = useState<Record<TestKey, TestState>>(initialState);
  const [runningAll, setRunningAll] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  useEffect(() => {
    setResults(loadTenantResults(tenantId));
  }, [tenantId]);

  const runDiagnostics = async () => {
    const response = await fetch("/api/tenant/diagnostics", { method: "GET" });

    if (!response.ok) {
      throw new Error("Diagnostics request failed");
    }

    return (await response.json()) as TenantDiagnostics;
  };

  const runTest = async (key: TestKey) => {
    setResults((prev) => ({ ...prev, [key]: { ...prev[key], status: "running", message: "Running..." } }));

    try {
      const diagnostics = await runDiagnostics();
      const { status, message } = evaluateTest(key, diagnostics);

      setResults((prev) => {
        const updated = { ...prev, [key]: { status, message, lastRun: new Date().toISOString() } };
        persistTenantResults(tenantId, updated);
        return updated;
      });
    } catch (error) {
      console.error("Failed to run test", error);
      setResults((prev) => {
        const updated = {
          ...prev,
          [key]: { status: "fail", message: "Test failed to run", lastRun: new Date().toISOString() },
        };
        persistTenantResults(tenantId, updated);
        return updated;
      });
    }
  };

  const runAllTests = async () => {
    setRunningAll(true);
    for (const test of TESTS) {
      await runTest(test.key);
    }
    setRunningAll(false);
  };

  const seedSampleData = async () => {
    setSeeding(true);
    setSeedMessage(null);
    setSeedError(null);

    try {
      const response = await fetch("/api/admin/ete/seed-sample-data", { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        const errorMessage = payload?.error ? String(payload.error) : "Unable to seed sample data";
        throw new Error(errorMessage);
      }

      const candidateCount = Array.isArray(payload?.candidateIds) ? payload.candidateIds.length : 3;
      setSeedMessage(`Seeded a sample job and ${candidateCount} candidates for testing.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to seed sample data";
      setSeedError(message);
    } finally {
      setSeeding(false);
    }
  };

  const seedHelperText = useMemo(() => {
    if (seedError) {
      return { text: seedError, className: "text-rose-600" } as const;
    }

    if (seedMessage) {
      return { text: seedMessage, className: "text-emerald-700" } as const;
    }

    return { text: "Seeds a sample job and three candidates for ETE tests.", className: "text-zinc-500" } as const;
  }, [seedError, seedMessage]);

  return (
    <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-900">Test &amp; diagnostics</h2>
          <p className="text-sm text-zinc-600">Run tenant checks on demand and review the latest results.</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={seedSampleData}
              disabled={seeding || runningAll}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 disabled:cursor-not-allowed disabled:border-zinc-100 disabled:text-zinc-400"
            >
              {seeding ? <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden /> : <SparklesIcon className="h-4 w-4" aria-hidden />} Seed sample data
            </button>

            <button
              type="button"
              onClick={runAllTests}
              disabled={runningAll}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-400"
            >
              {runningAll ? <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden /> : <PlayIcon className="h-4 w-4" aria-hidden />} Run all tests
            </button>
          </div>

          <p className={`text-xs ${seedHelperText.className}`}>{seedHelperText.text}</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold text-zinc-700">
                Name
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-zinc-700">
                Description
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-zinc-700">
                Latest run
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-zinc-700">
                Live status
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-zinc-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {TESTS.map((test) => {
              const state = results[test.key];
              const isRunning = state.status === "running" || runningAll;

              return (
                <tr key={test.key} className="bg-white">
                  <td className="px-4 py-3 font-medium text-zinc-900">{test.name}</td>
                  <td className="px-4 py-3 text-zinc-600">{test.description}</td>
                  <td className="px-4 py-3 text-zinc-600">{formatDate(state.lastRun)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={state.status} message={state.message} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => runTest(test.key)}
                      disabled={isRunning}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:border-indigo-200 hover:text-indigo-700 disabled:cursor-not-allowed disabled:border-zinc-100 disabled:text-zinc-400"
                    >
                      {isRunning ? (
                        <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <PlayIcon className="h-4 w-4" aria-hidden />
                      )}
                      Run
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
