# Admin test panel usage

The **Test & diagnostics** panel under `/admin/tenant/{tenantId}/diagnostics` is a catalog of checks for tenant readiness.

- Use it to see which database, config, and guardrail checks are expected before enabling a tenant.
- Execution is disabled in Vercel deployments; copy commands and run them locally or in CI instead.
