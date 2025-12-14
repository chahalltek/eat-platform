The ETE platform is a [Next.js](https://nextjs.org) application with CI guardrails baked in for security- and compliance-sensitive features.

<<<<<<< ours
## Architecture references

- [API map](docs/architecture/api-map.md) — route groups, ownership (EAT vs. ETE), and where to add new endpoints.
- [EAT vs. ETE blueprint](docs/architecture/eat-vs-ete.md) — the platform-first intent, current split, and realignment plan.
=======
## Architecture
- [API map](./docs/architecture/api-map.md) – overview of `src/app/api/*` route groups grouped by platform primitives vs. ETE experiences.
- [EAT vs ETE alignment](./docs/architecture/eat-vs-ete.md) – how the original platform blueprint compares to the current ETE implementation and a plan to realign.
>>>>>>> theirs

## Definition of Done (DoD) enforcement

The CI workflow enforces our enterprise DoD. A build will fail when any of the following protections do not pass:

- **Coverage must stay at 100%.** `vitest` thresholds are pinned to 100% across statements/branches/functions/lines. Run `npm test` (or `npm run coverage`) locally to verify before opening a PR.
- **No TODO/FIXME markers in protected domains.** Auth, billing, and tenant code (`src/lib/auth/**`, `src/lib/billing/**`, `src/lib/tenant/**`) are scanned via `npm run ci:todo-scan`.
- **Configuration validation for the target environment.** `npm run ci:config-validate` exercises `src/lib/config/configValidator` with production-like variables to ensure required secrets and flags are present.
- **Deployment health gates.** `npm run predeploy` now re-validates config, reruns tests, and blocks deploys when Prisma client generation drifts from the checked-in schema.

### Running the DoD checks locally

```bash
# Enforce coverage and config/DoD gates
NODE_ENV=production \
APP_ENV=production \
DATABASE_URL=postgres://local:local@db.example.com:5432/db \
SSO_ISSUER_URL=https://sso.example.com \
SSO_CLIENT_ID=local \
SSO_CLIENT_SECRET=secret \
BILLING_PROVIDER_SECRET_KEY=key \
BILLING_WEBHOOK_SECRET=secret \
TENANT_MODE=multi \
npm run ci:config-validate

npm run ci:todo-scan
npm test
npm run predeploy
```

If any check fails, CI will block the merge until the issue is resolved.

## TenantUser backfill and seeding

- The `TenantUser` join table was created in migration `20270630120000_add_tenant_user_memberships`, but no data was inserted by that migration.
- Local seed data (`npm run seed`) creates an admin membership for the default tenant only; this seed is **not** run in production deployments.
- Migration `20270715120000_backfill_tenant_user_memberships` now backfills membership rows by pairing every existing `User.tenantId` with the matching `Tenant`. The insertion is idempotent and uses the existing user `role` so it can be safely applied to production and any fresh environment via `prisma migrate deploy`.
