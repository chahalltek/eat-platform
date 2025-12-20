export type SopSubsection = {
  id: string;
  title: string;
  body?: string[];
  bullets?: string[];
  steps?: string[];
};

export type SopSection = {
  id: string;
  title: string;
  summary?: string;
  body?: string[];
  bullets?: string[];
  steps?: string[];
  subsections?: SopSubsection[];
};

export type SourcingRecruitingSop = {
  title: string;
  description: string;
  owner: string;
  version: string;
  contact: string;
  lastUpdated: string;
  sections: SopSection[];
};

export const sourcingRecruitingSop: SourcingRecruitingSop = {
  title: "Enhanced Sourcing & Recruiting SOP",
  description:
    "End-to-end operating procedure for intake, sourcing, engagement, evaluation, submission, and offer support inside the ETE console.",
  owner: "Talent Operations",
  version: "v1.0",
  contact: "talent-ops@ete.example",
  lastUpdated: "2026-02-17",
  sections: [
    {
      id: "purpose-scope",
      title: "Purpose & Scope",
      summary: "Define how sourcing and recruiting are executed consistently, auditable, and in alignment with client commitments.",
      body: [
        "This SOP covers every step from intake through offer support for all ETE-led requisitions and recruiter-assist workstreams.",
        "It applies to all talent pods, regardless of desk or geography, and is the single source for required artifacts, approvals, and SLAs.",
      ],
      bullets: [
        "Authoritative inside the app: edits are made here and mirrored to downstream runbooks.",
        "Optimized for desktop review; mobile is view-only.",
        "Use linked anchors for quick references during live recruiting work.",
      ],
    },
    {
      id: "operating-principles",
      title: "Operating Principles",
      summary: "Guardrails that inform every workflow step.",
      bullets: [
        "Recruiter control: automation proposes; recruiters approve or adjust before candidates are submitted.",
        "Traceability: every decision must link to a documented rationale, signal, or data artifact.",
        "Candidate respect: avoid duplicate outreach, respect do-not-contact flags, and disclose AI assistance when required.",
        "Source-of-truth discipline: Bullhorn remains the system of record; ETE enriches, scores, and orchestrates actions.",
        "Security-first: redact PII in prompts; never export resumes or notes outside approved channels.",
      ],
    },
    {
      id: "roles-responsibilities",
      title: "Roles & Responsibilities",
      summary: "Who owns what at each stage and how handoffs work.",
      subsections: [
        {
          id: "role-sourcing-lead",
          title: "Sourcing Lead",
          bullets: [
            "Owns search strategy, talent map, and keyword stacks.",
            "Publishes daily sourcing notes and search pivots for recruiter review.",
            "Partners with data team to enrich profiles and flag signal gaps.",
          ],
        },
        {
          id: "role-recruiter",
          title: "Recruiter",
          bullets: [
            "Owns intake, candidate calibration, screening, and submission quality.",
            "Determines outreach voice, sequencing, and disclosure requirements.",
            "Maintains hiring manager comms and escalates blockers within SLA.",
          ],
        },
        {
          id: "role-hiring-manager",
          title: "Hiring Manager / Client POC",
          bullets: [
            "Provides intake sign-off, decision rubric, and interview availability.",
            "Reviews shortlists within agreed SLA and returns actionable feedback.",
          ],
        },
        {
          id: "role-qa-compliance",
          title: "QA & Compliance",
          bullets: [
            "Audits submissions for data hygiene, consent, and redaction.",
            "Controls kill-switches for automation and approves exceptions to outreach templates.",
          ],
        },
      ],
    },
    {
      id: "systems-inputs",
      title: "Systems & Required Inputs",
      summary: "What must be captured before sourcing starts.",
      bullets: [
        "Bullhorn job ID and confirmed job status (open, priority, or hold).",
        "Structured intake notes: must include top 5 must-haves, 3 nice-to-haves, disqualifiers, and compensation bands.",
        "Calibrated exemplars: at least three approved candidate profiles or resumes to seed search patterns.",
        "Channel rules: approved boards, exclusions, geography, and diversity goals when provided.",
        "Communication preferences: approved outreach template family, sender identity, and required disclosures.",
      ],
    },
    {
      id: "intake-prioritization",
      title: "Intake & Prioritization",
      summary: "Establish the target profile, constraints, and urgency.",
      steps: [
        "Schedule 30-minute intake with hiring manager or recruiter-of-record; capture decisions in the intake template.",
        "Convert intake notes to a structured rubric (skills, experience bands, location, work authorization).",
        "Tag requisition priority (P1/P2/P3) and expected slate size. P1 requires daily standups until slate delivered.",
        "Create an intake recap in the app and store link in Bullhorn job description notes.",
        "Identify measurement plan: what success looks like for the first slate and first hire.",
      ],
    },
    {
      id: "search-strategy",
      title: "Search Strategy & Market Map",
      summary: "Design the search plan and confirm it with the recruiter within 24 hours of intake.",
      body: [
        "The sourcing lead drafts the market map, including talent pools, competitor lists, and Boolean stacks.",
        "Focus on two primary search vectors plus one exploratory vector to validate optional requirements early.",
      ],
      bullets: [
        "Build keyword stacks for titles, skills, industries, and alternates; save them in the search library entry.",
        "Document excluded titles/industries to avoid off-target profiles.",
        "Set location rules (radius, time zones, remote eligibility) and compensation guardrails.",
        "Flag diversity goals or compliance constraints when provided by the client.",
      ],
    },
    {
      id: "candidate-discovery",
      title: "Candidate Discovery & Enrichment",
      summary: "Source, de-duplicate, and enrich candidates before outreach.",
      steps: [
        "Pull an initial batch from approved sources (Bullhorn search, internal talent graph, and licensed boards).",
        "De-duplicate across sources; respect do-not-contact lists and prior outreach logs.",
        "Enrich with role-relevant signals (tenure, stack recency, industry moves) and normalize titles.",
        "Score candidates using MQI/TSI where available; mark calibration candidates separately.",
        "Publish the daily sourcing note: what changed, what signals worked, and blockers needing recruiter input.",
      ],
    },
    {
      id: "outreach-nurture",
      title: "Outreach & Nurture",
      summary: "Engage candidates with compliant, personalized outreach and managed follow-ups.",
      body: [
        "Outreach is opt-in and respectful; never send more than two automated attempts without a human review.",
        "All templates must include client-approved disclosure and unsubscribe language where required.",
      ],
      bullets: [
        "Attempt 1 (Day 0): personalized opener referencing relevant signal; clear role value prop; reply-to monitored inbox.",
        "Attempt 2 (Day 2): value-based follow-up with new information (timeline, compensation range, manager context).",
        "Attempt 3 (Day 5, optional): light nudge only if prior engagement > 20% reply rate for the req.",
        "Log every outreach in Bullhorn; sync transcripts when responses arrive.",
      ],
    },
    {
      id: "screening-qualification",
      title: "Screening & Qualification",
      summary: "Validate interest, eligibility, and fit before submission.",
      steps: [
        "Run a 10–15 minute screen or collect structured responses asynchronously using approved forms.",
        "Confirm legal work status, location alignment, comp expectations, notice period, and interview availability.",
        "Assess core skills against the rubric; record evidence-based notes (what signal, where observed).",
        "Mark disposition with reason codes for all non-submitted leads (e.g., comp mismatch, skills gap, opted out).",
        "Update Bullhorn and the app with a concise summary and risk flags before sending to the recruiter for review.",
      ],
    },
    {
      id: "submission-handoff",
      title: "Submission & Hiring Team Handoff",
      summary: "Deliver a clean, decision-ready packet to the hiring team.",
      bullets: [
        "Package includes resume, summary, rubric scores, and availability snapshot.",
        "Highlight 3–5 evidence statements mapped to must-have criteria; avoid generic adjectives.",
        "Ensure resume formatting is legible; remove PII not required for evaluation before sharing externally.",
        "Send submission via Bullhorn and note the link in the app for traceability.",
        "Recruiter confirms receipt with the hiring manager and requests feedback SLA commitment (48 hours standard).",
      ],
    },
    {
      id: "interview-support",
      title: "Interview Support & Feedback",
      summary: "Keep loops moving and capture structured feedback.",
      steps: [
        "Schedule interviews within 24 hours of manager approval; share interview plan and expected outcomes.",
        "Prepare candidate with role brief, team context, and logistics; confirm attendance the business day prior.",
        "Collect feedback using structured rubric; avoid free-text only responses.",
        "Escalate no-shows or stalled feedback to hiring manager and talent ops within one business day.",
        "Update dispositions immediately after decision; log learnings to refine sourcing vectors.",
      ],
    },
    {
      id: "offer-prestart",
      title: "Offer, Close, and Pre-start",
      summary: "Drive acceptance with clear signals and proactive risk mitigation.",
      bullets: [
        "Pre-offer check: reconfirm comp expectations, start date, competing processes, and blockers.",
        "Offer presentation: recruiter or hiring manager delivers; sourcing lead provides competitive intel if asked.",
        "Close plan: document candidate motivators, risk signals, and required approvals.",
        "Post-accept follow-through: share onboarding checklist and confirm start date logistics.",
      ],
    },
    {
      id: "data-compliance",
      title: "Data Hygiene, Consent, and Security",
      summary: "Protect candidate data and keep systems aligned.",
      bullets: [
        "Bullhorn is the system of record. All status changes, outreach, and notes must sync within 24 hours.",
        "Do not paste full resumes, contact details, or unredacted notes into LLM prompts; use approved summaries.",
        "Respect regional privacy rules: honor deletion requests and document consent where required.",
        "Tag all records with source and consent status; avoid duplicate profiles by merging on email + LinkedIn.",
        "Kill-switch automation when anomalies are detected (spikes in bounce rate, low reply quality, or policy flags).",
      ],
    },
    {
      id: "slas-quality",
      title: "SLAs, Escalations, and Quality Controls",
      summary: "Time-bound expectations and how to resolve blockers.",
      subsections: [
        {
          id: "sla-standards",
          title: "Standard SLAs",
          bullets: [
            "Intake recap published within 24 hours of kickoff.",
            "First calibrated slate (3–5 candidates) delivered within 3 business days for P1 roles.",
            "Manager feedback returned within 48 hours of submission; escalate if silent.",
            "Outreach replies acknowledged within one business day.",
          ],
        },
        {
          id: "escalations",
          title: "Escalations",
          bullets: [
            "Escalate stalled feedback (>48 hours) to hiring manager + talent ops lead.",
            "Escalate data hygiene or compliance risks immediately to QA & Compliance.",
            "Log a blocker in the app with owner and deadline; review in daily standup for P1 roles.",
          ],
        },
        {
          id: "quality-controls",
          title: "Quality Controls",
          bullets: [
            "Weekly QA audit of 10% of submissions for evidence quality and redaction.",
            "Spot-check outreach for personalization, disclosure, and opt-out handling.",
            "Retro after every first slate to refine search vectors based on signal performance.",
          ],
        },
      ],
    },
    {
      id: "change-management",
      title: "Change Management & Versioning",
      summary: "Keep this SOP authoritative and easy to update.",
      body: [
        "This page is the single maintained source. When updating, edit the content file once and re-run app deploys; avoid duplicating in slide decks.",
        "Version updates require a changelog entry, owner sign-off, and communication in the weekly enablement note.",
      ],
      bullets: [
        "Minor edits (grammar, clarity) can be merged by Talent Ops.",
        "Material changes (new SLAs, new automation) require QA & Compliance approval plus recruiter enablement.",
        "Include effective date and reviewer initials in the changelog section.",
      ],
    },
  ],
};
