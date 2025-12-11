export type TestPlanStatusValue = "not_run" | "pass" | "fail" | "blocked";

export const TEST_PLAN_STATUS_OPTIONS: { value: TestPlanStatusValue; label: string }[] = [
  { value: "not_run", label: "Not run" },
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "blocked", label: "Blocked" },
];

export type TestPlanSection = {
  id: string;
  title: string;
  subtitle?: string;
  readOnly?: boolean;
  body?: string[];
};

export type TestPlanItem = {
  id: string;
  sectionId: string;
  label: string;
  description: string;
  isCritical?: boolean;
};

export const TEST_PLAN_SECTIONS: TestPlanSection[] = [
  {
    id: "1-purpose",
    title: "Purpose",
    subtitle: "Why this test plan exists",
    readOnly: true,
    body: [
      "Document the acceptance gates for the EAT MVP so we can ship with confidence.",
      "Give admins a single place to record results, capture edge cases, and revisit quality over time.",
    ],
  },
  {
    id: "2-scope",
    title: "Scope",
    subtitle: "What is covered for this MVP release",
  },
  {
    id: "3-test-types",
    title: "Test Types",
    subtitle: "How we validate the system",
  },
  {
    id: "4-mvp-charter",
    title: "MVP Test Charter (Never-ship list)",
    subtitle: "Critical items that must pass before release",
  },
  {
    id: "5.1-agents",
    title: "5.1 Agents and pipeline",
    subtitle: "Unit and integration coverage for matching and data prep",
  },
  {
    id: "5.2-rina-rua",
    title: "5.2 RINA and RUA",
    subtitle: "Resume and role intake behaviors",
  },
  {
    id: "5.3-libraries",
    title: "5.3 Jobs / Candidates libraries",
    subtitle: "Tables, filters, and matcher hooks",
  },
  {
    id: "5.4-runs",
    title: "5.4 Agent Runs and Execution History",
    subtitle: "Run visibility and detail views",
  },
  {
    id: "5.5-status",
    title: "5.5 System Status and Diagnostics",
    subtitle: "Operational panels and diagnostics",
  },
  {
    id: "5.6-controls",
    title: "5.6 System Controls and Feature Flags",
    subtitle: "Control plane and tenant protections",
  },
  {
    id: "6-environments",
    title: "Environments and Data",
    subtitle: "Seed data, fixtures, and separation",
  },
  {
    id: "7-tooling",
    title: "Tooling",
    subtitle: "Automation and observability",
  },
  {
    id: "8-entry-exit",
    title: "Entry / Exit Criteria",
    subtitle: "When we start and when we ship",
  },
];

export const TEST_PLAN_ITEMS: TestPlanItem[] = [
  // Scope
  {
    id: "scope.inScopeValidated",
    sectionId: "2-scope",
    label: "In-scope items validated",
    description: "Core EAT agents, matching, diagnostics, and system controls are included in the MVP runlist.",
  },
  {
    id: "scope.outOfScopeDocumented",
    sectionId: "2-scope",
    label: "Out-of-scope documented",
    description: "Any deferred features or integrations are called out so gaps are intentional.",
  },
  {
    id: "scope.personasAligned",
    sectionId: "2-scope",
    label: "Personas and tenants aligned",
    description: "Admin persona and target tenants identified for validation and telemetry.",
  },

  // Test types
  {
    id: "types.smokeAndRegression",
    sectionId: "3-test-types",
    label: "Smoke and regression defined",
    description: "Baseline smoke/regression paths exist to keep MVP happy paths green.",
  },
  {
    id: "types.integration",
    sectionId: "3-test-types",
    label: "Integration flows covered",
    description: "Cross-agent flows (intake → scoring → explain) have positive and negative checks.",
  },
  {
    id: "types.uat",
    sectionId: "3-test-types",
    label: "UAT ready",
    description: "Admin-facing validation steps are ready for sign-off with stakeholders.",
  },
  {
    id: "types.nonFunctional",
    sectionId: "3-test-types",
    label: "Non-functional gates",
    description: "Resilience, guardrails, and data quality behaviors have explicit expectations.",
  },

  // MVP Test Charter (critical)
  {
    id: "mvp.systemStatus",
    sectionId: "4-mvp-charter",
    label: "System Status – panel renders and reports correct health",
    description:
      "System status panel renders for a valid tenant. Database, Agents, Scoring Engine, Tenant Config all report correctly as Healthy / Warning / Error.",
    isCritical: true,
  },
  {
    id: "mvp.rina",
    sectionId: "4-mvp-charter",
    label: "RINA – resume ingestion works",
    description: "Given a sample resume, RINA creates or updates a candidate and indexes skills.",
    isCritical: true,
  },
  {
    id: "mvp.rua",
    sectionId: "4-mvp-charter",
    label: "RUA – role intake works",
    description: "Given a job intake form, a Job record is created with required fields and is available in the Jobs library.",
    isCritical: true,
  },
  {
    id: "mvp.match",
    sectionId: "4-mvp-charter",
    label: "MATCH – returns and ranks matches",
    description: "For a seeded job and three candidates, MATCH returns at least one match and matches are sorted by score descending.",
    isCritical: true,
  },
  {
    id: "mvp.confidence",
    sectionId: "4-mvp-charter",
    label: "CONFIDENCE – returns valid bands",
    description: "For a match result, CONFIDENCE returns a valid score or band (e.g. HIGH / MED / LOW).",
    isCritical: true,
  },
  {
    id: "mvp.explain",
    sectionId: "4-mvp-charter",
    label: "EXPLAIN – human-readable reasons",
    description: "For a matched job / candidate pair, EXPLAIN returns human readable reasons that reference skills or attributes.",
    isCritical: true,
  },
  {
    id: "mvp.shortlist",
    sectionId: "4-mvp-charter",
    label: "SHORTLIST – correct subset",
    description: "For multiple candidates, SHORTLIST returns a subset (not the full set) consistent with the configured threshold.",
    isCritical: true,
  },
  {
    id: "mvp.jobsCandidates",
    sectionId: "4-mvp-charter",
    label: "Jobs & Candidates – basic tables work",
    description: "Jobs table renders without error and includes seeded test job. Candidates table renders and includes seeded candidates.",
    isCritical: true,
  },
  {
    id: "mvp.diagnostics",
    sectionId: "4-mvp-charter",
    label: "Diagnostics – endpoint works",
    description: "Tenant diagnostics endpoint returns a list of tables with health status and does not throw.",
    isCritical: true,
  },
  {
    id: "mvp.systemControls",
    sectionId: "4-mvp-charter",
    label: "System controls – flags usable",
    description: "Feature flags can be read and toggled by an admin user without error.",
    isCritical: true,
  },

  // 5.1 Agents and pipeline
  {
    id: "agents.unit.match.perfectMatch",
    sectionId: "5.1-agents",
    label: "Matching – perfect match",
    description: "Perfect match when all must-have skills present.",
  },
  {
    id: "agents.unit.match.partialMatch",
    sectionId: "5.1-agents",
    label: "Matching – partial match",
    description: "Partial matches rank below perfect candidates when some requirements are missing.",
  },
  {
    id: "agents.unit.match.noMatch",
    sectionId: "5.1-agents",
    label: "Matching – no candidate meets minimum criteria",
    description: "Matcher returns empty results or clear messaging when nothing qualifies.",
  },
  {
    id: "agents.unit.confidence.high",
    sectionId: "5.1-agents",
    label: "Confidence – high band",
    description: "High confidence band returned with supporting signals for strong matches.",
  },
  {
    id: "agents.unit.confidence.medium",
    sectionId: "5.1-agents",
    label: "Confidence – medium band",
    description: "Medium band produced with appropriate caveats for partial evidence.",
  },
  {
    id: "agents.unit.confidence.low",
    sectionId: "5.1-agents",
    label: "Confidence – low band",
    description: "Low confidence when data quality is weak or missing.",
  },
  {
    id: "agents.unit.intake.messyDescription",
    sectionId: "5.1-agents",
    label: "Intake – messy description",
    description: "Handles noisy job descriptions without crashing; normalizes key fields.",
  },
  {
    id: "agents.unit.profile.partialProfile",
    sectionId: "5.1-agents",
    label: "Profiles – partial profile",
    description: "Gracefully handles missing candidate fields and flags gaps for downstream agents.",
  },
  {
    id: "agents.integration.pipeline.scenarioA",
    sectionId: "5.1-agents",
    label: "Pipeline – scenario A",
    description: "End-to-end pipeline succeeds for standard job and resume pairings.",
  },
  {
    id: "agents.integration.pipeline.scenarioB",
    sectionId: "5.1-agents",
    label: "Pipeline – scenario B",
    description: "Alternate pipeline path (e.g. multiple candidates) produces stable results.",
  },

  // 5.2 RINA and RUA
  {
    id: "rina.upload.valid",
    sectionId: "5.2-rina-rua",
    label: "RINA – valid upload",
    description: "Resume upload ingests and indexes a new candidate.",
  },
  {
    id: "rina.upload.updateExisting",
    sectionId: "5.2-rina-rua",
    label: "RINA – update existing",
    description: "Uploading an updated resume refreshes the existing candidate profile.",
  },
  {
    id: "rina.upload.invalidType",
    sectionId: "5.2-rina-rua",
    label: "RINA – invalid file type",
    description: "Unsupported file types are rejected with a friendly message.",
  },
  {
    id: "rua.create.requiredOnly",
    sectionId: "5.2-rina-rua",
    label: "RUA – required fields only",
    description: "Submitting only required fields still creates a usable job profile.",
  },
  {
    id: "rua.create.missingRequired",
    sectionId: "5.2-rina-rua",
    label: "RUA – missing required fields",
    description: "Validation prevents save and highlights missing required data.",
  },
  {
    id: "rua.edit.preserveMatches",
    sectionId: "5.2-rina-rua",
    label: "RUA – edits preserve matches",
    description: "Editing a role keeps previous matches accessible or clearly re-runs scoring.",
  },

  // 5.3 Jobs / Candidates libraries
  {
    id: "jobs.table.pagination",
    sectionId: "5.3-libraries",
    label: "Jobs table – pagination",
    description: "Pagination works with seeded jobs and retains filters.",
  },
  {
    id: "jobs.table.scoringColumn",
    sectionId: "5.3-libraries",
    label: "Jobs table – scoring column",
    description: "Scoring or status columns render without errors and show latest run state.",
  },
  {
    id: "jobs.table.runMatcher",
    sectionId: "5.3-libraries",
    label: "Jobs table – run matcher",
    description: "Triggering matcher from the table starts a run and surfaces results.",
  },
  {
    id: "candidates.table.filters",
    sectionId: "5.3-libraries",
    label: "Candidates table – filters",
    description: "Filter chips work and combine with search without breaking pagination.",
  },
  {
    id: "candidates.detail.viewFields",
    sectionId: "5.3-libraries",
    label: "Candidate detail – view fields",
    description: "Candidate detail view shows normalized skills, experience, and contact info.",
  },

  // 5.4 Agent Runs and Execution History
  {
    id: "runs.page.recentExecutions",
    sectionId: "5.4-runs",
    label: "Runs – recent executions",
    description: "Recent agent runs list newest executions with clear status.",
  },
  {
    id: "runs.page.statusAndTimestamps",
    sectionId: "5.4-runs",
    label: "Runs – status and timestamps",
    description: "Start/end times and durations render in the runs table.",
  },
  {
    id: "runs.page.runDetails",
    sectionId: "5.4-runs",
    label: "Runs – run details",
    description: "Clicking a run shows parameters, outputs, and links to impacted entities.",
  },

  // 5.5 System Status and Diagnostics
  {
    id: "status.panel.renders",
    sectionId: "5.5-status",
    label: "Status panel renders",
    description: "System status widget loads for the tenant without errors.",
  },
  {
    id: "status.panel.refresh",
    sectionId: "5.5-status",
    label: "Status panel refresh",
    description: "Manual or automatic refresh updates subsystem health states.",
  },
  {
    id: "status.panel.brokenDbError",
    sectionId: "5.5-status",
    label: "Status panel – broken DB error",
    description: "Database outage surfaces a clear error instead of generic failure.",
  },
  {
    id: "diagnostics.listTables",
    sectionId: "5.5-status",
    label: "Diagnostics – list tables",
    description: "Diagnostics endpoint lists key tables with health status.",
  },
  {
    id: "diagnostics.missingTableReported",
    sectionId: "5.5-status",
    label: "Diagnostics – missing table reported",
    description: "Missing or unhealthy tables show as warnings/errors instead of silently passing.",
  },

  // 5.6 System Controls and Feature Flags
  {
    id: "flags.view",
    sectionId: "5.6-controls",
    label: "Feature flags – view",
    description: "Admins can view flags and descriptions for the tenant.",
  },
  {
    id: "flags.toggleAffectsBehavior",
    sectionId: "5.6-controls",
    label: "Feature flags – toggle affects behavior",
    description: "Toggling a flag changes downstream behavior (e.g., enabling/disabling agents).",
  },
  {
    id: "flags.nonAdminCantChange",
    sectionId: "5.6-controls",
    label: "Feature flags – non-admin blocked",
    description: "Non-admin users cannot toggle or edit system controls.",
  },
  {
    id: "adminPanel.testsRunReport",
    sectionId: "5.6-controls",
    label: "Admin panel – tests run report",
    description: "Admins can review what tests were executed for the tenant.",
  },
  {
    id: "adminPanel.seedSampleData",
    sectionId: "5.6-controls",
    label: "Admin panel – seed sample data",
    description: "Sample data seeding works without corrupting existing tenant data.",
  },

  // 6 Environments and Data
  {
    id: "env.sandboxReady",
    sectionId: "6-environments",
    label: "Sandbox ready",
    description: "Sandbox/staging environments have fixtures and seeded data for repeatable runs.",
  },
  {
    id: "env.dataIsolation",
    sectionId: "6-environments",
    label: "Data isolation",
    description: "Tenant data is isolated between environments; seeded records don't leak.",
  },
  {
    id: "env.refreshProcess",
    sectionId: "6-environments",
    label: "Refresh process documented",
    description: "Instructions exist for refreshing test data without downtime.",
  },

  // 7 Tooling
  {
    id: "tooling.ciSmoke",
    sectionId: "7-tooling",
    label: "CI smoke suite",
    description: "CI runs smoke or test:smoke suite to guard deployments.",
  },
  {
    id: "tooling.observability",
    sectionId: "7-tooling",
    label: "Observability",
    description: "Dashboards/alerts exist for agents, scoring, and ingestion health.",
  },
  {
    id: "tooling.testDataUtilities",
    sectionId: "7-tooling",
    label: "Test data utilities",
    description: "Scripts/utilities exist to seed, reset, and inspect test data.",
  },

  // 8 Entry / Exit Criteria
  {
    id: "entry.criteriaReviewed",
    sectionId: "8-entry-exit",
    label: "Entry criteria reviewed",
    description: "Preconditions (data seeded, flags configured) checked before starting.",
  },
  {
    id: "entry.blockersLogged",
    sectionId: "8-entry-exit",
    label: "Blockers logged",
    description: "Known blockers captured with owners and mitigation plan.",
  },
  {
    id: "exit.charterPass",
    sectionId: "8-entry-exit",
    label: "Charter items passed",
    description: "All MVP charter (critical) items are green or have approved exceptions.",
  },
  {
    id: "exit.signoff",
    sectionId: "8-entry-exit",
    label: "Exit sign-off",
    description: "Stakeholders approve release based on recorded results and notes.",
  },
];

export const TEST_PLAN_ITEMS_BY_ID = new Map(TEST_PLAN_ITEMS.map((item) => [item.id, item] as const));

export function isValidTestPlanItemId(itemId: string): boolean {
  return TEST_PLAN_ITEMS_BY_ID.has(itemId);
}

export function getTestPlanSectionsWithItems() {
  return TEST_PLAN_SECTIONS.map((section) => ({
    section,
    items: TEST_PLAN_ITEMS.filter((item) => item.sectionId === section.id),
  }));
}

export const TOTAL_TEST_PLAN_ITEMS = TEST_PLAN_ITEMS.length;
