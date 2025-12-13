# ETE-GTM-301-B – Pricing Model (non-enforcing)

This document defines the pricing levers for ETE without implementing billing or entitlements. It aligns with SKU packaging from `docs/ete-gtm-301-product-tiers.md` and keeps Bullhorn as the authoritative system of record.

## Pricing dimensions

- **Jobs analyzed / month** – Count of open or active job orders processed through MATCH/CONFIDENCE/EXPLAIN/SHORTLIST.
- **Candidates evaluated / month** – Number of individual candidate profiles scored or short-listed per month.
- **Agent runs** – Discrete executions of L2 agents (e.g., Strategy, Outreach), regardless of whether they trigger downstream actions.
- **Copilot queries** – Natural language prompts to Executive Copilot (or similar) that invoke ETE models.
- **Benchmark access (yes/no)** – Boolean entitlement that unlocks market/benchmark content; treated as an enablement toggle instead of volume.

## SKU → pricing dimensions

| SKU | Billable metrics | Non-billable metrics | Notes |
| --- | --- | --- | --- |
| ETE Intelligence Core | Jobs analyzed / month; Candidates evaluated / month; Agent runs | Copilot queries; Benchmark access | Volumetric pricing tied to matching throughput; agent runs priced when used for guardrails or enrich/learn cycles. |
| ETE Market Insights | Benchmark access (yes/no) | Jobs analyzed / month; Candidates evaluated / month; Agent runs; Copilot queries | Benchmarks are the paid unlock; all usage is read-only and does not trigger per-unit billing. |
| ETE Executive Copilot | Agent runs; Copilot queries | Jobs analyzed / month; Candidates evaluated / month; Benchmark access | Pricing follows conversational + automation consumption; underlying data processing is bundled. |

This mapping is captured in `src/config/pricingModel.ts` for visibility only (no enforcement hooks).

## Why we price intelligence, not seats

- Pricing scales with analytical value delivered (jobs, candidates, answers) instead of headcount.
- Non-seat pricing removes procurement friction for operational users and supports viral adoption.
- Aligns with AI cost drivers (compute/model calls) while keeping user growth predictable for customers.

## Why Bullhorn remains the system of record

- ETE enriches and scores data but persists authoritative records (jobs, candidates, activity) in Bullhorn for compliance and auditability.
- Minimizes reconciliation risk by avoiding parallel systems for placements, ownership, and reporting.
- Reduces change management: Bullhorn workflows, permissions, and reporting stay intact while ETE augments intelligence layers.

## Expansion paths

- Upsell from Intelligence Core to Executive Copilot by activating L2 agent runs and Copilot queries on existing data.
- Cross-sell Market Insights by enabling benchmark access for strategy teams without touching production workflows.
- Introduce higher-volume tiers (e.g., 10k/50k jobs analyzed per month) or reserved-usage commitments for predictable budgeting.
- Add premium dimensions later (e.g., regional benchmark packs, dedicated model capacity) without changing SKU structure.
