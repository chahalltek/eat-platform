# Authentication and RBAC overview

## How users authenticate
- Users sign in via the `/api/auth/login` endpoint, which accepts an email and password and compares the password against `AUTH_PASSWORD`/`AUTH_PASSWORD_LOCAL` (default `"password"`).【F:src/app/api/auth/login/route.ts†L30-L68】
- The login handler looks up a user in Prisma (default tenant fallback) and mints a signed `eat_session` cookie containing user id, email, display name, role, tenant id, issued-at, and expiry fields.【F:src/app/api/auth/login/route.ts†L70-L103】【F:src/lib/auth/session.ts†L37-L95】
- Sessions are HMAC-signed, 7-day tokens validated by `validateSessionToken`, which rejects invalid or expired cookies and clears them when middleware encounters errors.【F:src/lib/auth/session.ts†L97-L158】【F:src/middleware.ts†L24-L54】
- Logout clears the session cookie and returns `{ success: true }`.【F:src/app/api/auth/logout/route.ts†L24-L33】
- A `/login` UI posts to the login endpoint with email/password and redirects to `next` (default `/`) on success.【F:src/app/login/page.tsx†L14-L66】

## How tenant context is determined
- Middleware resolves tenant and user ids from the session, query parameters (`tenantId`/`userId`), or defaults, then injects them into request and response headers (`x-eat-tenant-id`, `x-eat-user-id`, `x-eat-user-role`).【F:src/middleware.ts†L56-L92】
- Helpers such as `getCurrentTenantId` read tenant id from the session, query params, or headers (falling back to `DEFAULT_TENANT_ID`).【F:src/lib/tenant.ts†L1-L36】
- Identity helpers expose the current user/roles/tenant id based on the decoded session claims with `normalizeRole` used to sanitize role strings.【F:src/lib/auth/identityProvider.ts†L8-L83】

## Role model and enforcement
- Roles are enumerated in `USER_ROLES` (ADMIN, MANAGER, RECRUITER, SOURCER, SALES, SYSTEM_ADMIN, FULFILLMENT_SOURCER, FULFILLMENT_RECRUITER, FULFILLMENT_MANAGER) with normalization helpers and an `isAdminRole` shortcut.【F:src/lib/auth/roles.ts†L1-L31】
- Fulfillment-focused permissions (`fulfillment.view`, `agent.run.*`, `decision.*`, `admin.rbac.manage`) map progressively to sourcer/recruiter/manager variants and are exposed via helpers such as `canRunAgentIntake`, `canRunAgentMatch`, `canRunAgentShortlist`, `canPublishDecision`, and `canManageRbac` (admin inherits the full set).【F:src/lib/auth/permissions.ts†L8-L167】【F:src/lib/auth/permissions.ts†L197-L263】
- Middleware applies coarse RBAC: admin paths (`/admin`, `/api/admin`) require admin/system admin; recruiter paths (`/candidates`, `/jobs`, `/agents`, `/dashboard`, `/api`) require one of the recruiter-oriented roles.【F:src/middleware.ts†L19-L44】
- Agent and decision endpoints now enforce the fulfillment permissions before executing (e.g., intake/match/explain/shortlist and decision stream/receipt handlers), so sourcers cannot publish decisions while recruiters/managers/admins can.【F:src/app/api/agents/intake/route.ts†L65-L99】【F:src/app/api/agents/match/route.ts†L78-L111】【F:src/app/api/agents/shortlist/route.ts†L21-L63】【F:src/app/api/decision-stream/item/route.ts†L12-L41】【F:src/app/api/decision-receipts/route.ts†L4-L54】
- Permission helpers map roles to capabilities (e.g., `MANAGE_PROMPTS`, `VIEW_AGENT_LOGS`) and include tenant checks for system admins vs. tenant-bound roles.【F:src/lib/auth/permissions.ts†L1-L75】【F:src/lib/auth/permissions.ts†L87-L131】
- The job candidate status endpoint adds a resource-level check: non-admins must own the job candidate before updating status; updates are audited with IP capture.【F:src/app/api/job-candidate/status/route.ts†L36-L83】

## Protected vs. public endpoints
- Middleware runs for all routes except `_next` assets, favicon, and the explicitly public paths `/health`, `/api/health`, `/api/auth/login`, `/api/auth/logout`, `/api/ats/bullhorn/webhook`, and `/login`. Requests without a valid session receive 401 responses and invalid/expired cookies are cleared.【F:src/middleware.ts†L16-L55】
- All `/api` endpoints are rate limited per tenant/user, with admin/recruiter role gates applied as described above.【F:src/middleware.ts†L94-L122】
- Fulfillment agent endpoints (intake, match/matcher, explain, shortlist, profile via RINA) check permission helpers in addition to middleware, feature flag, and kill-switch guards.【F:src/app/api/agents/intake/route.ts†L65-L129】【F:src/app/api/agents/match/route.ts†L78-L106】【F:src/app/api/agents/matcher/route.ts†L12-L77】
- Outreach/RUA agents and job ingestion still rely on the middleware role gates plus feature flag/kill-switch checks rather than per-handler permissions.【F:src/app/api/agents/outreach/route.ts†L5-L83】【F:src/app/api/agents/rua/route.ts†L6-L58】【F:src/app/api/jobs/ingest/route.ts†L1-L48】
- Admin-facing diagnostics and export routes rely on the admin middleware gate and tenant resolution helpers but do not implement per-feature permission checks yet.【F:src/app/api/tenant/diagnostics/route.ts†L1-L18】【F:src/app/api/tenant/export/route.ts†L1-L17】

## Known gaps / TODOs
- Some data ingestion/status endpoints (e.g., ATS webhooks, job ingestion, candidate status updates) still rely on coarse middleware guards and need resource-level enforcement.【F:src/app/api/ats/bullhorn/webhook/route.ts†L1-L52】【F:src/app/api/jobs/ingest/route.ts†L1-L48】【F:src/app/api/job-candidate/status/route.ts†L1-L40】
