# TenantConfig schema drift (P2022)

Prisma schema currently expects guardrail metadata for each tenant to live on `TenantConfig.preset` and `TenantConfig.llm`:

- `preset` is modeled as an optional string for selecting a guardrail preset.
- `llm` is modeled as optional JSON for tenant-specific LLM overrides.

These attributes are present in the checked-in Prisma datamodel, so the client will try to read them and throw `P2022` if the columns are missing.

## What the schema expects

The `TenantConfig` model defines both fields and keeps `networkLearning` settings alongside them:

- `preset String?`
- `llm Json?`
- `networkLearningOptIn Boolean @default(false)`
- `networkLearning Json?`

## What the database currently ships

The deployed database is missing the `preset` and `llm` columns, which triggers `P2022` during guardrail lookups. The migrations that should add those columns have not been applied yet:

- `20270815120000_usage_metering` adds `preset`, `llm`, `networkLearningOptIn`, and `networkLearning` to `TenantConfig`.
- `20271201120000_backfill_tenant_config_preset` re-applies the same columns to close the drift.
- `20271215144900_ensure_tenant_config_preset_column`, `20271220120000_add_missing_tenant_config_preset`, and `20271221120000_add_missing_tenant_config_llm_column` exist solely to patch environments where the earlier migrations were skipped.

Because those migrations are absent from the deployed environment, the table only contains the original guardrail columns (`scoring`, `explain`, `safety`, timestamps, and `tenantId`).

## How to confirm in an environment

Run either of the following against the target database to verify the drift:

```bash
# List columns via psql
psql "$DATABASE_URL" -c '\d "TenantConfig"'

# Or use Prisma migrate status
DATABASE_URL="$DATABASE_URL" npx prisma migrate status --schema prisma/schema.prisma
```

If `preset` or `llm` are missing from the column list, deploy the migrations above (starting with `20270815120000_usage_metering`) to realign the table with the Prisma client. The safety net migration `20280520120000_ensure_tenant_config_llm_and_preset` re-applies all four guardrail columns so that a fresh `prisma migrate deploy` will bring long-lived databases back into alignment even if earlier patches were skipped.
