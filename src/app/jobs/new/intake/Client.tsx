"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { SopContextualLink } from "@/components/SopContextualLink";
import { BackToConsoleButton } from "@/components/BackToConsoleButton";
import { WorkflowShortcuts } from "@/components/workflows/WorkflowShortcuts";
import type { IntakeSkill, JobIntakeProfile, JobIntakeResponse, MarketSignal } from "@/types/intake";

type JobIntakeClientProps = {
  showSopLink?: boolean;
};

function mergeSkills(mustHaves: string[], skills: IntakeSkill[]) {
  const combined = new Map<string, IntakeSkill>();

  for (const mustHave of mustHaves) {
    const key = mustHave.toLowerCase();
    if (!combined.has(key)) {
      combined.set(key, { name: mustHave, required: true });
    }
  }

  for (const skill of skills) {
    const key = skill.name.toLowerCase();
    if (!combined.has(key)) {
      combined.set(key, { name: skill.name, required: skill.required, weight: skill.weight });
    }
  }

  return Array.from(combined.values());
}

export default function JobIntakeClient({ showSopLink }: JobIntakeClientProps) {
  const router = useRouter();
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [profile, setProfile] = useState<JobIntakeProfile | null>(null);
  const [isRunningIntake, setIsRunningIntake] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const intakeSkills = useMemo(() => {
    if (!profile) return [];
    return mergeSkills(profile.mustHaves, profile.skills);
  }, [profile]);

  const marketInsights = useMemo(() => {
    const frictionLevel = profile?.frictionLevel ?? "medium";
    const poolImpact = profile?.candidatePoolImpact ?? 42;
    const estimatedTimeToFill = profile?.estimatedTimeToFillDays ?? 41;
    const marketAverageTimeToFill = profile?.marketAverageTimeToFillDays ?? 29;

    const defaultSignals: MarketSignal[] = [
      {
        title: "Harder than average to fill",
        description: "Regional demand is outpacing supply for this role.",
        tone: "caution",
      },
      {
        title: "Must-haves shrink the pool",
        description: `Must-have skills reduce candidate pool by ~${poolImpact}%.`,
        tone: "info",
      },
      {
        title: "Time-to-fill outlook",
        description: `Estimated time-to-fill: ${estimatedTimeToFill} days (market avg: ${marketAverageTimeToFill} days).`,
      },
    ];

    return {
      frictionLevel,
      poolImpact,
      estimatedTimeToFill,
      marketAverageTimeToFill,
      signals: profile?.marketSignals?.length ? profile.marketSignals : defaultSignals,
    };
  }, [profile]);

  async function handleRunIntake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaveError(null);
    setIsRunningIntake(true);

    try {
      const response = await fetch("/api/agents/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: jobDescription,
          title: jobTitle || undefined,
          customer: customerName || undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Unable to run intake" }));
        throw new Error(body.error || "Unable to run intake");
      }

      const data: JobIntakeResponse = await response.json();
      setProfile(data.profile);
      setJobTitle((prev) => prev || data.profile.title || "");
      setCustomerName((prev) => prev || data.profile.customer || "");
    } catch (err) {
      console.error("Failed to run intake", err);
      setProfile(null);
      setError(err instanceof Error ? err.message : "Unable to run intake");
    } finally {
      setIsRunningIntake(false);
    }
  }

  async function handleSaveJob() {
    if (!profile) {
      setSaveError("Run intake before saving");
      return;
    }

    const titleToSave = jobTitle.trim() || profile.title || "Untitled role";

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/jobs/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleToSave,
          rawDescription: jobDescription,
          skills: intakeSkills,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Unable to save job" }));
        throw new Error(body.error || "Unable to save job");
      }

      const createdJob = await response.json();
      router.push(`/jobs/${createdJob.id}`);
    } catch (err) {
      console.error("Failed to save job", err);
      setSaveError(err instanceof Error ? err.message : "Unable to save job");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-gray-600">Job Intake</p>
          <h1 className="text-3xl font-semibold text-gray-900">Run Job Intake</h1>
          <p className="mt-2 text-gray-600">
            Paste a job description, review the parsed profile, and save it to the job list.
          </p>
          {showSopLink ? <SopContextualLink context="intake" className="mt-3" /> : null}
          <WorkflowShortcuts currentPath="/intake" className="mt-3" />
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <BackToConsoleButton />
        </div>
      </div>

      <form onSubmit={handleRunIntake} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="customer">
              Customer (optional)
            </label>
            <input
              id="customer"
              type="text"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="title">
              Title (optional)
            </label>
            <input
              id="title"
              type="text"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Senior Product Manager"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="description">
            Job description
          </label>
          <textarea
            id="description"
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            required
            rows={8}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Paste the full job description here"
          />
        </div>

        {error && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isRunningIntake || !jobDescription.trim()}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isRunningIntake ? "Running Intake..." : "Run Intake"}
          </button>
          <p className="text-xs text-gray-500">Only authenticated recruiters and admins can access this tool.</p>
        </div>
      </form>

      {profile && (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-600">Job Profile</p>
              <h2 className="text-2xl font-semibold text-gray-900">Intake Results</h2>
            </div>
            <button
              type="button"
              onClick={handleSaveJob}
              disabled={isSaving}
              className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isSaving ? "Saving..." : "Save Job"}
            </button>
          </div>

          <div className="rounded-lg border border-indigo-100 bg-indigo-50/80 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Market signals</p>
                <h3 className="text-lg font-semibold text-slate-900">Guidance at the moment of job creation</h3>
                <p className="text-sm text-slate-700">
                  Recruiters see market friction immediately—no forced actions, just helpful context.
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <span
                  className={
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold " +
                    (marketInsights.frictionLevel === "low"
                      ? "bg-emerald-100 text-emerald-800"
                      : marketInsights.frictionLevel === "high"
                        ? "bg-amber-200 text-amber-900"
                        : "bg-indigo-100 text-indigo-800")
                  }
                >
                  <span
                    className={
                      "h-2 w-2 rounded-full " +
                      (marketInsights.frictionLevel === "low"
                        ? "bg-emerald-500"
                        : marketInsights.frictionLevel === "high"
                          ? "bg-amber-600"
                          : "bg-indigo-500")
                    }
                    aria-hidden
                  />
                  {marketInsights.frictionLevel === "low"
                    ? "Low market friction"
                    : marketInsights.frictionLevel === "high"
                      ? "High market friction"
                      : "Moderate market friction"}
                </span>
                <a
                  className="text-sm font-medium text-indigo-700 underline-offset-4 hover:text-indigo-800 hover:underline"
                  href="/admin/guardrails"
                >
                  Adjust guardrails
                </a>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {marketInsights.signals.map((signal) => (
                <div
                  key={signal.title}
                  className="rounded-lg border border-white/70 bg-white/70 p-3 shadow-sm shadow-indigo-100"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-2.5 w-2.5 rounded-full ${
                        signal.tone === "caution"
                          ? "bg-amber-500"
                          : signal.tone === "info"
                            ? "bg-indigo-500"
                            : "bg-slate-400"
                      }`}
                      aria-hidden
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{signal.title}</p>
                      <p className="text-sm text-slate-700">{signal.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Customer</div>
              <div className="text-lg font-medium text-gray-900">{customerName || profile.customer || "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Title</div>
              <div className="text-lg font-medium text-gray-900">{jobTitle || profile.title || "—"}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">Must-haves</div>
              {profile.mustHaves.length === 0 ? (
                <p className="mt-2 text-sm text-gray-600">No must-haves identified.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm text-gray-800">
                  {profile.mustHaves.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">Skills</div>
              {intakeSkills.length === 0 ? (
                <p className="mt-2 text-sm text-gray-600">No skills identified.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm text-gray-800">
                  {intakeSkills.map((skill) => (
                    <li key={skill.name} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-green-500" aria-hidden />
                      <div>
                        <div className="font-medium text-gray-900">{skill.name}</div>
                        {skill.required && (
                          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Must-have</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-900">Ambiguities</div>
            {profile.ambiguities.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">No ambiguities detected.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm text-gray-800">
                {profile.ambiguities.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {saveError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</div>
          )}
        </div>
      )}
    </div>
  );
}
