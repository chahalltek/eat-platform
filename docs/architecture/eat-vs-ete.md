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
