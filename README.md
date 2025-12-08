This project is a [Next.js](https://nextjs.org) application with CI guardrails baked in for security- and compliance-sensitive features.

## Definition of Done (DoD) enforcement

The CI workflow enforces our enterprise DoD. A build will fail when any of the following protections do not pass:

- **Coverage must stay at 100%.** `vitest` thresholds are pinned to 100% across statements/branches/functions/lines. Run `npm test` (or `npm run coverage`) locally to verify before opening a PR.
- **No TODO/FIXME markers in protected domains.** Auth, billing, and tenant code (`src/lib/auth/**`, `src/lib/billing/**`, `src/lib/tenant/**`) are scanned via `npm run ci:todo-scan`.
- **Configuration validation for the target environment.** `npm run ci:config-validate` exercises `src/lib/config/configValidator` with production-like variables to ensure required secrets and flags are present.
- **Deployment health gates.** `npm run predeploy` remains part of the pipeline to mirror production deploy checks.

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
