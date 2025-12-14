# Batch 1 Completion Audit (Intent + Inputs + Data Plumbing)

Goal: confirm Batch 1 outcomes exist in code, tests, or docs and record how to verify them.

## How this checklist was built
- Searched the repo for Batch 1 references and intent/data plumbing surfaces (agents, ingestion, uploads).
- Traced the live endpoints and server logic that implement intent capture, input handling, and data persistence.
- Linked each item to concrete evidence (source, tests) and added manual verification steps.

## Ticket checklist
| Ticket ID | Intent | Status | Evidence | How to verify manually |
| --- | --- | --- | --- | --- |
| B1-INTAKE | Job description intent extraction via INTAKE agent with persistence to `jobReq`/`jobSkill`. | ✅ | `runIntake` parses LLM output, validates it, updates job + skills, and logs metrics.【F:src/server/agents/intake.ts†L36-L125】 | 1) Seed a `jobReq` with `rawDescription`.<br>2) Call `POST /api/agents/intake` with the job ID.<br>3) Confirm updated `jobReq` fields + `jobSkill` rows and an agent run record. |
| B1-JOB-INGEST | Authenticated job ingestion that builds intent payload and upserts `jobIntent`. | ✅ | `POST /api/jobs/ingest` validates payloads, enforces admin roles, ingests the job, constructs intent payload, and upserts `jobIntent`.【F:src/app/api/jobs/ingest/route.ts†L31-L107】 | 1) Use an admin user token.<br>2) Call `POST /api/jobs/ingest` with title, skills, and optional description.<br>3) Check DB for new job, intent payload row, and emitted metric. |
| B1-RESUME-UPLOAD | Resume upload plumbing that extracts and sanitizes text for downstream PROFILE parsing. | ✅ | Upload route validates file metadata/size, extracts text, sanitizes content, and persists the blob while returning structured details.【F:src/app/api/upload/resume/route.ts†L26-L95】 | 1) Submit multipart `file` to `POST /api/upload/resume` (PDF/DOCX).<br>2) Expect JSON with `text`, `blobPath`, and mime type.<br>3) Verify rejection for oversized or unsupported files. |
| B1-INTENT-SNAPSHOT | Hiring manager surfaces read persisted `jobIntent` snapshots for downstream briefs/feedback. | 🟡 | HM brief endpoint pulls `jobIntent` snapshot tied to the job; relies on populated intent data.【F:src/app/api/jobs/[jobReqId]/hm-brief/route.ts†L47-L76】 | 1) Ensure a `jobIntent` exists for the job.<br>2) Call `GET /api/jobs/{jobReqId}/hm-brief`.<br>3) Validate response contains intent-derived context; investigate upstream ingestion if missing. |

## Gaps and follow-ups
- No explicit Batch 1 ticket IDs were present in the repo; the IDs above are audit placeholders aligned to the Intent/Input/Data Plumbing scope. Replace them with canonical IDs if provided.
- Consider adding API contract tests for HM brief/feedback paths to move B1-INTENT-SNAPSHOT to ✅.
