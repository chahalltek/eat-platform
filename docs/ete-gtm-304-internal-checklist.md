# ETE-GTM-304-A: Internal Enablement Checklist & Guardrails

## Purpose
Align sales and delivery teams on what Enterprise Talent Experience (ETE) can credibly promise, what is roadmap-only, and what we should never claim. This guide also answers common internal questions so deals move faster without custom promises.

## Checklist

### What ETE can promise today
- Native candidate search and ranking across integrated applicant sources.
- Interview scheduling with calendar sync and automated candidate notifications.
- Configurable hiring workflows with stage-level SLAs and alerts.
- Hiring team collaboration: shared notes, @mentions, and consensus scorecards.
- Compliance controls: role-based access, audit trails, and exportable activity logs.
- Data residency choices (US/EU) with SOC 2-aligned security controls.
- Bullhorn integration for read/write of job, candidate, and submission records using approved APIs.
- Standard reporting: time-to-fill, stage conversion, funnel health, and recruiter productivity.
- Support for SSO (SAML/OIDC) and SCIM-based user provisioning.

### Roadmap-only (do not promise dates externally)
- Automated candidate outreach sequencing and nurture campaigns.
- Native offer-letter generation with template management and e-signature.
- In-product DEI analytics beyond standard funnel reporting.
- Embedded assessments and coding challenges.
- Multi-ATS synchronization (Bullhorn + secondary ATS) in a single tenant.
- Auto-generated job descriptions with AI assistance.
- Fine-grained data residency per business unit.

### Never claim
- Full ATS replacement today (ETE is a Bullhorn-first extension, not a wholesale ATS swap).
- Unlimited custom integrations outside approved API surface without scoping.
- Irreversible SLAs that bypass Bullhorn rate limits or data governance.
- Ownership of client candidate data beyond processing on their behalf.

## Internal FAQ

### Security
- **Certifications:** SOC 2 Type II in progress; standard controls (encryption in transit/at rest, least-privilege access, audit logging) enforced today.
- **Access:** SSO supported via SAML/OIDC; RBAC with least privilege; admin actions logged.
- **Isolation:** Tenant-level logical isolation; production access via break-glass with approvals.
- **Data handling:** All PII encrypted at rest; backups encrypted and retention-managed per policy.
- **Pen testing:** Third-party pen tests are run at least annually with remediation tracking.

### Data ownership
- Clients own their data; ETE processes data as a processor only.
- Data portability: exports available upon request; deletion workflows follow contractual SLAs.
- No secondary use of candidate data for model training without explicit customer consent.

### Bullhorn relationship
- ETE is built to extend Bullhorn; not positioned as an ATS replacement.
- Integrations use Bullhorn’s supported APIs with adherence to rate limits and data governance.
- Joint roadmap coordination is required for new integration scope; avoid custom promises without Bullhorn review.

## How to use this guide
- **Pre-sales:** Confirm “today” items only; label roadmap items as future and non-committal on timelines.
- **Statements of Work:** Link to this checklist; escalate any deviation for approval.
- **CS/Delivery:** Use FAQ responses to answer common security and data questions; avoid creating one-off commitments.
- **Enablement:** Review quarterly and update with Product and Security before changing promises.

## Success criteria
- Sales and delivery teams reference the same checklist when scoping deals.
- Custom promises decrease because roadmap and “never claim” items are explicit.
- Deal cycles accelerate because FAQ answers are centrally documented.
