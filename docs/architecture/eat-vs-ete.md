<<<<<<< ours
# EAT vs. ETE Blueprint

## Blueprint Intent
- **Platform first (EAT):** Build a control plane that is tenant-aware, auditable, and operable. All shared services—auth, feature flags, metrics, tenant configuration, agents, ingestion—belong here so they can be reused by every surface area.
- **Talent Success second (ETE):** Deliver forecasts, market intelligence, and recruiter-facing experiences on top of the platform primitives. ETE should stay thin and focus on the consumable insights while deferring storage, policy, and orchestration to EAT-owned modules.

## Current State
- The codebase reflects the platform-first direction: `/api/admin`, `/api/tenant`, `/api/feature-flags`, `/api/ops`, `/api/system-state`, `/api/system-status`, and `/api/agents` are operated as shared services.
- ETE delivery routes exist (`/api/ete/*`, `/api/match` as a legacy agent endpoint, and `network-intelligence-batch6`) but still lean on platform-owned data models, Prisma clients, and agent orchestration patterns.
- Some workflows (e.g., match feedback, decision streams) are being shared by both sides, which reinforces the need for clear boundaries and documentation.

## Realignment Plan
1. **Harden platform contracts.** Stabilize the agent runtime surface (`/api/agents/*`), tenant safety primitives, and feature-flag enforcement so ETE can treat them as dependencies instead of customizing per feature.
2. **Thin ETE endpoints.** Keep `ete/*` routes focused on presentation and data shaping. Push persistence, metrics emission, and policy checks down into platform modules to avoid duplication.
3. **Retire legacy edges.** Gradually migrate `/api/match` and other one-off endpoints into the standardized agent patterns, documenting any differences in authorization or payloads.
4. **Codify ownership in docs.** Keep the API map and route inventory current so future endpoints start in the correct lane and avoid cross-cutting concerns.
=======
# EAT vs ETE Alignment

This note captures how the EAT platform blueprint translates into the current ETE implementation and what should realign.

## Original blueprint intent
- **Platform capabilities first.** A reusable control plane (auth, tenancy, feature flags, kill switches, environment toggles, upload/ingestion helpers) was meant to power any experience, not just ETE.
- **EAT-TS capability buckets.** The blueprint grouped work into buckets: control plane and tenancy; ingestion/normalization (ATS webhooks, file uploads); intelligence runtimes (agent orchestration, matching, guardrails); and trust/safety/telemetry (decision streams, metrics, health/state reporting).
- **Experience layers on top.** ETE was supposed to sit on these primitives, consuming them via well-defined APIs while keeping product logic outside the platform folders.

## Current ETE implementation snapshot
- The production surface is a Next.js App Router service with API route groups under `src/app/api/*` that mix platform primitives (admin, auth, tenant, feature-flags, system-state/status, ops, cron, health) with ETE experiences (agents, legacy `match`, ATS webhooks, job/candidate ingest, recruiter metrics, decision stream, ETE outcomes).
- Agent-centric workflows dominate the experience layer: match/shortlist/outreach/intake/explain, feedback capture, and outcome reporting are all first-class routes.
- Ingestion is present but narrow: Bullhorn is the only ATS webhook, and resume upload is the only generic file parser.

## Where drift shows up
- Platform folders still contain ETE-specific edges (for example, ops status is agent-focused, and legacy `/api/match` keeps product semantics inside the platform tree).
- Capability buckets exist but are uneven: telemetry currently centers on recruiter-behavior metrics and decision-stream fetches, while broader observability is concentrated in `system-state`/`system-status` snapshots.
- Experience naming is split between the modern `agents/*` surface and compatibility shims (`match`, `job-candidate`, bespoke `ete/outcomes`).

## Realignment plan
- **Reaffirm lanes.** Keep control-plane concerns (`admin`, `auth`, `tenant`, flags, ops/system-state/status) strictly platform; route any product-specific monitoring or UX data (e.g., recruiter metrics) through clearly labeled experience folders.
- **Consolidate agent entry points.** Prefer `agents/{capability}` over new legacy top-level routes; retire shims such as `/api/match` once callers migrate.
- **Broaden ingestion safely.** Treat new ATS/webhook or upload handlers as platform-provided utilities with tenancy, guardrails, and audit logging baked in, then expose them through explicit ETE experience endpoints.
- **Strengthen telemetry.** Extend the trust/safety bucket by wiring agent usage, decision-stream access, and recruiter-behavior metrics into a unified monitoring view alongside system-state/status snapshots.
>>>>>>> theirs
