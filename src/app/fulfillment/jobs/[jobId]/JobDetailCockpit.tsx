"use client";

import clsx from "clsx";
import Link from "next/link";
import { MonoText } from "@/components/MonoText";
import { useMemo, useState } from "react";

type TabId =
  | "intake"
  | "matches"
  | "shortlist"
  | "explain"
  | "confidence"
  | "decisionMemory";

type TabDefinition = {
  id: TabId;
  label: string;
  headline: string;
  description: string;
};

const TABS: TabDefinition[] = [
  {
    id: "intake",
    label: "Intake",
    headline: "Intake and requirements",
    description: "Capture the hiring context, success criteria, and intake notes for this role.",
  },
  {
    id: "matches",
    label: "Matches",
    headline: "Matches",
    description: "Review pipeline candidates surfaced for the requisition.",
  },
  {
    id: "shortlist",
    label: "Shortlist",
    headline: "Shortlist",
    description: "Prioritize the strongest candidates for submission.",
  },
  {
    id: "explain",
    label: "Explain",
    headline: "Explainability",
    description: "Give recruiters context on why a candidate is recommended.",
  },
  {
    id: "confidence",
    label: "Confidence",
    headline: "Confidence",
    description: "Track signal quality and readiness for submittal.",
  },
  {
    id: "decisionMemory",
    label: "Decision Memory",
    headline: "Decision memory",
    description: "Persist learnings from submissions, interviews, and closes.",
  },
];

export type JobSummary = {
  id: string;
  title: string;
  client: string;
  priority: string;
  owner: string;
};

export type JobDetailCockpitProps = {
  job: JobSummary;
  showDeepLinkBanner: boolean;
  returnUrl?: string;
  sourceSystem?: string;
};

export function JobDetailCockpit({ job, returnUrl, showDeepLinkBanner, sourceSystem }: JobDetailCockpitProps) {
  const [activeTab, setActiveTab] = useState<TabId>("intake");

  const currentTab = useMemo(() => TABS.find((tab) => tab.id === activeTab) ?? TABS[0], [activeTab]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Job cockpit</p>
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold text-gray-900">{job.title}</h1>
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-700">Job ID:</span> <MonoText className="text-gray-900">{job.id}</MonoText>
              </p>
            </div>
          </div>
          <Link
            href="/jobs"
            className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Back to jobs
          </Link>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-gray-500">Client</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">{job.client}</dd>
          </div>
          <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-gray-500">Priority</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">{job.priority}</dd>
          </div>
          <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-gray-500">Owner</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">{job.owner}</dd>
          </div>
          <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-gray-500">Status</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">Draft cockpit</dd>
          </div>
        </dl>
      </header>

      {showDeepLinkBanner ? (
        <DeepLinkBanner jobId={job.id} returnUrl={returnUrl} sourceSystem={sourceSystem} />
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div
          role="tablist"
          aria-label="Job cockpit sections"
          className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 px-2 py-2"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "rounded-md px-4 py-2 text-sm font-semibold transition",
                activeTab === tab.id
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-100"
                  : "text-gray-600 hover:bg-white hover:text-gray-900",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          id={`${currentTab.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${currentTab.id}-tab`}
          className="space-y-3 p-6"
        >
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-gray-900">{currentTab.headline}</h2>
            <p className="text-sm text-gray-700">{currentTab.description}</p>
          </div>
          <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            Structured content for the {currentTab.label} tab will appear here. Use this section to wire up
            recruiter workflows, summaries, and Bullhorn deep links.
          </div>
        </div>
      </section>
    </div>
  );
}

type DeepLinkBannerProps = {
  jobId: string;
  returnUrl?: string;
  sourceSystem?: string;
};

function DeepLinkBanner({ jobId, returnUrl, sourceSystem }: DeepLinkBannerProps) {
  const systemLabel = sourceSystem ? sourceSystem : "external system";
  const jobPath = `/fulfillment/jobs/${jobId}`;
  const hasReturnUrl = Boolean(returnUrl);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Deep link contract</p>
          <p className="text-sm">
            Detected a return path from <span className="font-semibold">{systemLabel}</span>. Job cockpit URL:{" "}
            <MonoText as="code" className="text-amber-900">{jobPath}</MonoText>
          </p>
          {hasReturnUrl ? (
            <p className="text-xs text-amber-800">Return URL: {returnUrl}</p>
          ) : (
            <p className="text-xs text-amber-800">Waiting for a return URL to complete the handoff.</p>
          )}
        </div>
        {hasReturnUrl ? (
          <a
            href={returnUrl}
            className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
          >
            Return
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center rounded-md bg-amber-200 px-4 py-2 text-sm font-semibold text-amber-700"
          >
            Return
          </button>
        )}
      </div>
    </div>
  );
}
