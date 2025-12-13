# Talent Intelligence Canon

The canon codifies how ETE describes, measures, and differentiates core talent intelligence concepts. It is the single source of truth for product, sales, and marketing language; avoid ATS-derived terminology and default to these definitions.

## Match Quality Index (MQI)
- **Audience:** Client-facing; Publishable
- **Definition:** MQI is ETE’s composite score that summarizes how well a candidate aligns to a requisition’s success profile across skills, experience signals, delivery readiness, and verified intent. It blends structured data with live-market telemetry rather than static resume parsing.
- **Why it matters:** Teams need a fast, explainable signal that ranks candidates by expected fit and downstream retention, reducing recruiter guesswork and manual shortlist churn.
- **How ETE measures it:** Weighted model combining competency coverage, recentness of verified work, availability signals, and hiring team feedback loops; outputs a 0–100 score with rationale snippets and drift monitoring.
- **Bullhorn vs ETE:** Bullhorn surfaces keyword matches from a system of record; ETE computes MQI from real-time intelligence and feedback-informed weighting, turning stale profiles into live-fit predictions.

## Talent Scarcity Index (TSI)
- **Audience:** Client-facing; Publishable
- **Definition:** TSI quantifies the relative availability of qualified talent for a role in a given market by comparing active supply, engagement rates, and competing demand signals.
- **Why it matters:** Hiring plans and compensation bands hinge on knowing whether the market is tight or abundant; TSI enables realistic SLAs and stakeholder education.
- **How ETE measures it:** Normalizes candidate density, outreach responsiveness, and open-role volume by geography and specialty; outputs a percentile-based index with directional trend arrows.
- **Bullhorn vs ETE:** Bullhorn lists candidates without contextual scarcity; ETE delivers scarcity scoring with trends, letting teams preempt timeline and budget risks.

## Hiring Velocity
- **Audience:** Client-facing; Publishable
- **Definition:** Hiring Velocity tracks the cycle time from approved requisition to offer acceptance, segmented by stage and role family.
- **Why it matters:** It exposes bottlenecks, informs capacity planning, and sets credible hiring commitments with business leaders.
- **How ETE measures it:** Captures timestamps across intake, sourcing, slate delivery, interviews, and offer; reports median and p90 duration with stage-level deltas and alerts when velocity degrades.
- **Bullhorn vs ETE:** Bullhorn reports workflow steps; ETE adds intelligence by benchmarking velocity against scarcity and MQI quality, not just counting steps.

## Confidence Bands
- **Audience:** Internal-only (methodology); Client-facing summary allowed
- **Definition:** Confidence Bands describe the expected reliability range around ETE’s predictions (e.g., MQI or time-to-fill), reflecting data quality, sample size, and signal freshness.
- **Why it matters:** They calibrate stakeholder expectations, prevent overpromising, and guide when to trigger validation or data refresh.
- **How ETE measures it:** Uses Bayesian intervals over model outputs, adjusted for recency of events and variance in similar roles; displays as percentage bands tied to SLA commitments.
- **Bullhorn vs ETE:** Bullhorn offers point estimates without uncertainty; ETE operationalizes uncertainty so teams know when to trust, verify, or refresh signals.

## Guardrails
- **Audience:** Client-facing; Publishable
- **Definition:** Guardrails are predefined thresholds that keep talent workflows within acceptable risk and compliance bounds (e.g., minimum MQI, maximum aging on candidate data, bias checks).
- **Why it matters:** Guardrails standardize quality, reduce rework, and create auditability for leadership and compliance.
- **How ETE measures it:** Configurable policies monitored in real time; breaches trigger alerts and auto-corrections (e.g., suppressing stale outreach lists, requiring diverse slate checks).
- **Bullhorn vs ETE:** Bullhorn enforces process steps; ETE enforces intelligence-driven thresholds, adapting guardrails to live market signals.

## Fire Drill Mode
- **Audience:** Client-facing; Publishable
- **Definition:** Fire Drill Mode is an accelerated operating mode for critical reqs that prioritizes speed while preserving quality controls.
- **Why it matters:** High-urgency roles need a distinct playbook to avoid ad-hoc chaos and quality lapses.
- **How ETE measures it:** Activates higher outreach velocity, shortens SLA timers, and raises alert sensitivity; dashboards flag trade-offs and ensure guardrails (bias, freshness, MQI minimums) remain intact.
- **Bullhorn vs ETE:** Bullhorn speeds tasks; ETE orchestrates an end-to-end accelerated mode with safeguards and telemetry to prevent quality erosion.

## System of Record vs System of Intelligence
- **Audience:** Client-facing; Publishable
- **Definition:** A System of Record (SoR) stores transactional hiring data; a System of Intelligence (SoI) transforms signals from multiple systems into actionable guidance that continuously improves outcomes.
- **Why it matters:** Clients need clarity on why ETE complements, not replaces, existing ATS/CRM stacks while elevating decisions beyond data entry.
- **How ETE measures it:** ETE ingests SoR data plus external signals, enriches them with models like MQI and TSI, and feeds recommendations back into recruiter workflows with measurable lift (conversion, velocity, quality).
- **Bullhorn vs ETE:** Bullhorn is a strong SoR; ETE is the SoI that overlays predictive scoring, guardrails, and market benchmarks to unlock better hiring decisions without replacing the SoR.
