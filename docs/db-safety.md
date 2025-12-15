# Production database safety guard

This project ships with a guardrail script that blocks destructive database operations when a production environment is detected. The guard runs automatically in deployment builds and can be used to wrap Prisma CLI commands locally.

## Environment detection

The guard treats the deployment as **production** when any of these environment variables resolve to `production` (case-insensitive):

- `DEPLOYMENT_ENV`
- `VERCEL_ENV`
- `NODE_ENV`

When production is detected, `DATABASE_URL` must also be present. Attempts to bypass the guard with `DB_SAFETY_OVERRIDE=true` are ignored so that production guardrails remain enabled.

## Blocked commands and migrations

When production is active and the override is not set:

- Prisma commands that can drop or reset data are blocked (`migrate dev`, `migrate reset`, `db push`, `db execute`, or any command using `--force`/`--accept-data-loss`).
- Deployment fails if any migration SQL contains destructive statements such as `DROP TABLE`, `DROP COLUMN`, `ALTER TABLE ... DROP`, or `TRUNCATE TABLE`.
- Deployment fails when the target database has pending Prisma migrations. In non-production environments, the guard logs the migration status summary so drift can be fixed before promote/deploy.

## Usage

- **Deployment/build pipelines**: The guard runs before `next build` via `npm run build` and `npm run vercel-build`. If a destructive migration is present, the build will fail with guidance.
- **Manual Prisma commands**: Wrap Prisma invocations with the guard to enforce safety:

  ```bash
  npm run prisma:guard -- migrate deploy
  ```

  In production, blocked commands will exit with an error; in non-production environments the guard logs informational messages only.
