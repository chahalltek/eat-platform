import fs from "node:fs";
import path from "node:path";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import type { HealthStatus, SystemMapNode } from "@/app/system-map/opsImpact";
import { SystemMapContent } from "./SystemMapContent";

function getDocLastUpdated(docPath: string): { lastUpdatedIso: string } | null {
  if (!fs.existsSync(docPath)) {
    return null;
  }

  const stats = fs.statSync(docPath);

  return { lastUpdatedIso: stats.mtime.toISOString() };
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) return "Unknown";

  const formattedDate = parsedDate.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return formattedDate.toUpperCase();
}

function getLatestIsoDate(...values: Array<string | null | undefined>) {
  const timestamps = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((timestamp) => !Number.isNaN(timestamp));

  if (timestamps.length === 0) return null;

  return new Date(Math.max(...timestamps)).toISOString();
}

const systemNodes: readonly SystemMapNode[] = [
  {
    id: "intake",
    name: "Intake",
    type: "Entry",
    summary: "Jobs and resumes enter the system before any automation runs.",
    tags: ["Hiring manager inputs", "Resume uploads"],
    impact: "halts",
  },
  {
    id: "ats_adapter_sync",
    name: "ATS Adapter / Integrations",
    type: "Adapter",
    summary: "System ingress that syncs jobs and candidates from external systems into Intake and the database.",
    tags: ["Optional", "Sync"],
    impact: "degrades",
  },
  {
    id: "rua",
    name: "RUA",
    type: "Agent",
    summary: "Converts job descriptions into structured role profiles.",
    tags: ["Role normalization", "Guardrails applied"],
    impact: "halts",
  },
  {
    id: "rina",
    name: "RINA",
    type: "Agent",
    summary: "Standardizes resumes into candidate profiles with comparable fields.",
    tags: ["Resume parsing", "Title normalization"],
    impact: "halts",
  },
  {
    id: "database",
    name: "Database",
    type: "Data",
    summary: "System of record for profiles, scores, and audit logs.",
    tags: ["Job library", "Run history"],
    impact: "halts",
  },
  {
    id: "scoring_engine",
    name: "Scoring engine",
    type: "Engine",
    summary: "Ranks candidates against the role using job library context and weights.",
    tags: ["Matcher", "Job library"],
    impact: "halts",
  },
  {
    id: "confidence_explain",
    name: "Confidence / Explain",
    type: "Reasoning",
    summary: "Checks data quality, then produces rationales that cite evidence.",
    tags: ["Quality gates", "Narratives"],
    impact: "blocks",
  },
  {
    id: "agent_sync_expand",
    name: "Orchestration engine",
    type: "Coordination",
    summary: "Synchronizes agent runs and deterministic fan-out across downstream steps.",
    tags: ["Fan-out", "Scheduling"],
    impact: "degrades",
  },
  {
    id: "diagnostics_audit",
    name: "Diagnostics / Audit log",
    type: "Observability",
    summary: "Traces agent calls, inputs, and outcomes for troubleshooting.",
    tags: ["Audit trail", "Metrics"],
    impact: "isolated",
  },
  {
    id: "tenant_config",
    name: "Tenant Config",
    type: "Control plane",
    summary: "Control Plane thresholds, presets, and tuning per tenant.",
    tags: ["Weights", "LLM config", "Presets"],
    impact: "blocks",
  },
  {
    id: "feature_flags",
    name: "Feature Flags",
    type: "Control plane",
    summary: "Control Plane gates that combine agents and engines while keeping the UI safe.",
    tags: ["Access gates", "UI safety"],
    impact: "fails_closed",
  },
  {
    id: "runtime_controls",
    name: "Runtime Controls",
    type: "Control plane",
    summary: "Control Plane modes and safety latches that fail closed and log why.",
    tags: ["Pilot mode", "Kill switch", "Fire drill"],
    impact: "fails_closed",
  },
] as const;

const flowSequences = [
  {
    label: "Role flow",
    steps: ["Intake (RUA)", "Normalize", "Role profile"],
    note: "Role is stored and later used by matching and scoring engines.",
  },
  {
    label: "ATS / Integrations",
    steps: ["ATS Adapter / Integrations", "Jobs / Candidates", "Database", "Agents"],
    note: "Optional lane; resume uploads and manual intake remain valid entry points.",
  },
  {
    label: "Resume flow",
    steps: ["Profile (RINA)", "Normalize", "Database (results)", "Scoring engine", "Confidence / Explain"],
  },
  {
    label: "Scoring flow",
    steps: ["Role + Candidates", "Shortlist", "Database (results)", "Confidence / Explain"],
    note: "Uses roles from RUA and candidates from RINA / PROFILE to rank matches.",
  },
  {
    label: "OPS flow",
    steps: ["Agent endpoints", "Agent log + Audit", "Diagnostics UI"],
    note: "Debug agent runs with linked inputs, outputs, and traces.",
  },
  {
    label: "Guardrails",
    steps: ["Tenant Config", "Feature Flags", "Runtime Controls", "Scoring engine", "Confidence / Explain"],
    subtitles: ["thresholds", "gates", "failsafe", "calculations", "interpretation"],
    arrowVariant: "dashed",
  },
] satisfies {
  label: string;
  steps: readonly string[];
  subtitles?: readonly string[];
  arrowVariant?: "solid" | "dashed";
  note?: string;
}[];

const statusLegend: readonly { status: HealthStatus; label: string }[] = [
  { status: "healthy", label: "Healthy" },
  { status: "idle", label: "Idle" },
  { status: "waiting", label: "Waiting" },
  { status: "fault", label: "Fault" },
  { status: "disabled", label: "Disabled" },
];

const apiMapDocPath = path.join(process.cwd(), "docs/architecture/api-map.md");
const apiMapDocUrl = "https://github.com/edgeandnode/ete-platform/blob/main/docs/architecture/api-map.md";

const apiMapFallbackLastUpdatedIso = "2025-12-20T00:00:00.000Z";
const apiMapDocMetadata = getDocLastUpdated(apiMapDocPath);
const apiMapLastUpdatedIso =
  getLatestIsoDate(apiMapFallbackLastUpdatedIso, apiMapDocMetadata?.lastUpdatedIso) ?? apiMapFallbackLastUpdatedIso;
const apiMapLastUpdatedDisplay = formatDate(apiMapLastUpdatedIso);

export default function SystemMapPage() {
  return (

    <ETEClientLayout maxWidthClassName="max-w-6xl" contentClassName="space-y-10">

      <SystemMapContent
        apiMapDocUrl={apiMapDocUrl}
        apiMapLastUpdatedIso={apiMapLastUpdatedIso}
        apiMapLastUpdatedDisplay={apiMapLastUpdatedDisplay}
        systemNodes={systemNodes}
        flowSequences={flowSequences}
        statusLegend={statusLegend}
      />
    </ETEClientLayout>
  );
}
