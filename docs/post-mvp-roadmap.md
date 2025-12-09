# Post-MVP roadmap (skeleton)

This skeleton outlines the major areas to invest in after the MVP launch. Expand each section with owners, timelines, and dependencies as plans firm up.

## Future agents
- **ENGAGEMENT**: Conversation and nudging layer that keeps candidates and hiring teams active. Covers event-driven follow-ups, SLA reminders, and proactive risk alerts when activity drops.
- **LEARNING**: Feedback loop that uses hiring outcomes and recruiter interactions to improve matching, outreach copy, and prioritization. Includes human-in-the-loop labeling and A/B experiments.
- **INSIGHTS**: Analysis agent focused on real-time funnels, cohort comparisons, and recruiter productivity. Surfaces anomalies and recommends corrective actions.
- **ORCHESTRATOR**: Coordination layer that routes work across agents, enforces guardrails, and ensures data consistency. Handles escalation paths and conflict resolution when agents overlap.

## Integrations
- **ATS**: Bi-directional sync for candidates, jobs, and statuses with webhook-based updates. Start with the top ATS vendors used by design partners; publish mapping docs and failure playbooks.
- **SERVE**: Connect to SERVE for enrichment and profile validation; define fallbacks when enrichment fails or is rate limited.
- **Outreach tooling**: Plug into email/SMS/LinkedIn tools for sequenced outreach, respecting unsubscribe preferences and deliverability monitoring. Provide templating hooks for agents.

## Reporting and analytics
- Centralize metrics around funnel health (sourcing → outreach → interview → offer), recruiter throughput, and content performance.
- Ship self-serve dashboards for operators with drill-down to candidate/job detail, plus export and alerting capabilities.
- Maintain tracking plans and event schemas; add automated data quality checks and lineage documentation.

## Deferred tech debt (MVP)
- Harden background job retry/backoff strategies and add dead-letter queues where missing.
- Expand automated test coverage for multi-tenant access control, rate limiting, and error handling.
- Normalize logging and tracing across services with consistent correlation IDs and PII redaction.
- Document and automate disaster recovery steps (backups, restores, chaos drills) once production data patterns are known.
