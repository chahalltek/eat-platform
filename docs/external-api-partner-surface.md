# ETE-PROD-1702 – External API & Partner Surface

## Goal
Expose ETE intelligence to partners and internal STRSI tools through a stable external API with tenant-scoped access controls and operational safeguards.

## Target Consumers
- **Partners** integrating market data, shortlist export, and job scoring.
- **Internal STRSI tools** that need the same capabilities via an authenticated API surface.

## Authentication & Authorization
- **API keys per tenant** stored hashed; keys rotated via an admin console endpoint (`POST /v1/tenants/{tenantId}/api-keys`).
- **OAuth2 client credentials (optional future)** to align with internal identity providers; can co-exist with API keys.
- **Scopes** (granted per key/client):
  - `read:matches` – retrieve matches and shortlist status.
  - `read:shortlist` – fetch or export shortlist items.
  - `read:markets` – access market-level signals and inventory.
  - `read:insights` – retrieve market insights and reports.
  - `read:difficulty` – job difficulty scoring.
- **Tenancy isolation:** every request requires `X-Tenant-Id` header; middleware enforces scope + tenant before querying data.

## Rate Limits
- **Default:** 300 requests/min per tenant; burst up to 600 for 30s.
- **Per-scope overrides:** stricter for `read:markets` (100/min) to protect heavier queries.
- **Response headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- **Quota breach behavior:** HTTP 429 with retry-after; events pushed into audit log.

## APIs (v1)
| Area | Endpoint | Method | Scope | Notes |
| --- | --- | --- | --- | --- |
| Matches | `/v1/matches` | GET | `read:matches` | Filter by candidate/job IDs, status; paginated cursor. |
| Shortlist | `/v1/shortlist` | GET | `read:shortlist` | Returns shortlist with ranking metadata and export URL. |
| Markets | `/v1/markets` | GET | `read:markets` | Market inventory, supply/demand metrics. |
| Insights | `/v1/insights/{insightId}` | GET | `read:insights` | Precomputed insights/reports. |
| Job Difficulty | `/v1/jobs/{jobId}/difficulty` | GET | `read:difficulty` | Difficulty score plus drivers and suggested actions. |

### Responses
- **Consistent envelope:** `{ "data": <payload>, "meta": { "requestId", "generatedAt" } }`.
- **Pagination:** cursor-based (`nextCursor`, `prevCursor`) with `limit` parameter capped at 100.
- **Filtering:** allow `updatedSince`, `status`, and tenant-owned identifiers to minimize payload size.

## Auditing & Observability
- **Full audit logging:** request ID, tenant, path, scopes, rate-limit result, response code; persisted 30 days.
- **Data access lineage:** log dataset identifiers used per request for compliance.
- **Dashboards:** latency, error rate, and per-scope usage; alert on sustained 4xx/5xx or rate-limit saturation.

## Security Considerations
- Enforce TLS 1.2+; reject plaintext.
- Validate tenant ownership for every resource ID to prevent cross-tenant leakage.
- Schema validation at the edge (OpenAPI + runtime validators) to protect downstream services.
- Keys rotated every 90 days; automatically revoke leaked keys and notify contacts on anomalies.

## Rollout Plan
1. **MVP** – API key auth, scopes, rate limits, and auditing for the five endpoints.
2. **Pilot** – onboard first partner with constrained quotas; capture telemetry.
3. **General availability** – publish OpenAPI spec, enable sandbox keys, and document SLAs (99.5% uptime).
4. **Future** – migrate to OAuth2 clients where possible; add webhook callbacks for shortlist updates.

## Acceptance Mapping
- **API keys per tenant:** admin key issuance endpoint and tenancy header requirement.
- **Rate limits:** defaults plus per-scope overrides and 429 behavior.
- **Scopes:** explicitly listed scopes aligning to matches, shortlist, markets, insights, and difficulty scoring.
- **Full audit logging:** per-request audit entries with rate-limit events and dataset lineage.
- **External consumers can safely call ETE:** TLS enforcement, schema validation, tenancy isolation, and documented pagination/filtering.
