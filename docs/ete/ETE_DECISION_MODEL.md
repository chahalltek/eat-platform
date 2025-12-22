<<<<<<< ours
ETE Decision Model (MVP)
Purpose

EDGE Talent Engine (ETE) is a decision-support system for recruiting and fulfillment.
It exists to improve decision quality, explainability, and consistency, not to automate judgment or replace human authority.

This document defines what the ETE MVP is, is not, and the rules that must not be violated as the system evolves.

This is a binding reference for development, operations, and product decisions.

What ETE Is

A system that assists humans at key decision moments

A way to make tradeoffs explicit, not hide them

A mechanism for preserving reasoning and confidence over time

A layer that interprets and compares, not just ranks or sorts

A system that treats explanations as first-class output

ETE is designed to scale judgment, not activity.

What ETE Is Not

Not an ATS replacement

Not an automation-first recruiting engine

Not a “one-click” matching system

Not a black-box AI that silently decides outcomes

Not a performance optimization layer for Bullhorn or other systems of record

Bullhorn remains the system of record.
ETE is intentionally entered at decision moments.

MVP Scope

The MVP explicitly includes the following agent-supported workflows:

INTAKE – structured capture of job intent and constraints

PROFILE – normalization and interpretation of candidate signals

MATCH – comparative reasoning between job and candidates

CONFIDENCE – surfacing certainty, ambiguity, and tradeoffs

EXPLAIN – human-readable rationale for recommendations

SHORTLIST – decision-ready recommendations, not auto-submits

The MVP intentionally excludes:

autonomous submissions

silent automation of tradeoffs

self-modifying decision logic

closed-loop optimization without human review

Decision Model (Core Principle)

ETE operates on the following rule:

Agents recommend. Humans decide. The system remembers.

At no point should ETE:

finalize a hiring or submission decision without human confirmation

suppress uncertainty to appear more confident

optimize for speed at the expense of clarity or correctness

Do Not Violate (Hard Guardrails)

The following principles must hold, regardless of future feature work:

Human authority is explicit and visible
No agent may take irreversible action without a human decision point.

Explanations are mandatory for recommendations
If the system cannot explain why, it should not recommend.

Tradeoffs must be surfaced, not hidden
Ambiguity and uncertainty are signals, not failures.

Confidence is data, not decoration
Confidence levels must be stored, inspectable, and reviewable.

Memory is durable and intentional
Reasoning and decisions must persist beyond individual users.

Automation requires escalation
Any proposal to automate a human decision requires explicit review and approval.

Speed is a consequence, not a goal
Faster outcomes are acceptable only if decision quality is preserved.

If a proposed change violates any of the above, it must be stopped and reviewed.

Change Control Triggers

The following changes require explicit review against this document:

Introducing new automation at decision points

Modifying CONFIDENCE scoring or interpretation

Changing explanation structure or visibility

Altering human/agent boundaries

RBAC changes affecting Fulfillment workflows

Data retention, learning, or memory behavior changes

These are design decisions, not implementation details.

Ownership (MVP)
Area	Owner
Decision model & guardrails	Product / Ops
Agent behavior & boundaries	Product + Engineering
UI workflows & explainability	Engineering
Data governance & retention	Ops / Admin
System health & observability	Engineering

Ownership clarity matters more than speed.

Final Note

This document exists to make ETE transferable.

If the system requires verbal explanation to be used correctly, this document is incomplete.
If a change feels reasonable but violates this model, the model wins until reviewed.

End of document
=======
# ETE Decision Model

## Purpose
- ETE is a human-in-the-loop decision-support layer that surfaces evidence, options, and confidence to recruiters and fulfillment leaders.
- It is not an ATS replacement, ATS enhancement pack, or “automation-first” workflow engine; Bullhorn remains the workflow system of record.
- Agents advise and draft actions; humans authorize and execute decisions with clear explanations and auditability.

## MVP scope and non-goals
- **In scope:** Profile enrichment, signal gathering, match scoring, confidence scoring, shortlist creation, explanation payloads, and Bullhorn-safe write-backs that keep humans in charge.
- **Out of scope:** Autonomous outreach or scheduling, ATS workflow changes, silent updates to Bullhorn records, role-based access model changes, data retention policy changes, and unreviewed automation that bypasses explanations.

## Decision moments (human vs agent)
- **INTAKE:** Agent gathers signals and drafts intake summary; human confirms requirements and constraints.
- **PROFILE:** Agent enriches candidate profiles and highlights gaps; human approves what becomes candidate-of-record.
- **MATCH:** Agent scores and ranks options; human decides candidate and job pairing to pursue.
- **CONFIDENCE:** Agent computes confidence and tradeoffs; human sets thresholds and go/no-go.
- **EXPLAIN:** Agent generates rationale, risks, and alternatives; human reviews explanations before action.
- **SHORTLIST:** Agent drafts shortlist and write-back payload; human approves push to Bullhorn and downstream comms.

## Do Not Violate
- Humans retain final authority on candidate/job decisions; no silent automation of tradeoffs.
- Explanations are required for every recommended action; no opaque scoring or hidden overrides.
- Durable memory (decision history, rationale, and constraints) is first-class and must be preserved with write-backs.
- Bullhorn is the authoritative system of record; ETE writes back only through approved, auditable paths.
- Confidence logic and thresholds cannot change without review; no auto-tuning in production.
- RBAC boundaries (especially for Fulfillment) must not be weakened or bypassed by agents or tools.
- Data retention and guardrails (PII, tenancy, consent) must be honored; no speculative storage outside approved scopes.
- Sandbox or demo shortcuts must never leak into production tenants.

## Change control triggers (requires explicit review)
- Automation behavior changes that alter human approval points or make writes without confirmation.
- Confidence scoring logic, input weights, or threshold defaults.
- Explanation format, required fields, or omission of rationale and alternatives.
- RBAC, permissions, or delegation changes that affect Fulfillment or Bullhorn write paths.
- Data retention, logging, or guardrail adjustments that impact privacy, tenancy, or auditability.

## Ownership
| Decision area | Product | Ops | Eng |
| --- | --- | --- | --- |
| Scope boundaries and non-goals | 🔵 accountable | 🟢 consulted | 🟢 consulted |
| Human approval points and UX | 🔵 accountable | 🟢 consulted | 🟢 consulted |
| Confidence logic and thresholds | 🟢 consulted | 🔵 accountable | 🟢 consulted |
| Explanation requirements and format | 🔵 accountable | 🟢 consulted | 🟢 consulted |
| Bullhorn write-back safety and RBAC | 🟢 consulted | 🔵 accountable | 🔵 accountable |
| Data retention and guardrails | 🔵 accountable | 🟢 consulted | 🔵 accountable |

Legend: 🔵 = owns/approves; 🟢 = consulted.
>>>>>>> theirs
