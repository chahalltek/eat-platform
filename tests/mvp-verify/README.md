# MVP verification suite

This suite runs a minimal set of tests to audit the MVP surface without dragging the full test universe. It is designed to be deterministic and to avoid any database access.

## Included checks

- Job intent helper coverage (`src/lib/jobIntent.test.ts`)
- Agent run logging helpers (`src/lib/agentRunLog.test.ts`)
- Tenant diagnostics builder (`src/lib/tenant/diagnostics.test.ts`)
- Hire manager brief API verify test (`src/app/api/jobs/[jobReqId]/hm-brief/route.verify.test.ts`)
- Tenant operations runbook verify test (`src/app/admin/tenant/[tenantId]/operations-runbook/verify.test.tsx`)
- MVP smoke test (`tests/smoke/mvp-smoke.test.ts`)

## Running

Use the dedicated script to execute the suite sequentially:

```sh
npm run verify:mvp
```

The script pins Vitest to a single worker for determinism and should remain free of database interactions.
