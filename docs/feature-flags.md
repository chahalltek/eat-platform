# Feature flags

Feature flag checks are centralized in `src/lib/featureFlags.ts`. The helper
functions there safely handle missing database tables and return booleans.

- `getFeatureFlag(tenantId, name)`: resolves the flag for a specific tenant.
- `isEnabled(tenantId, name)`: shorthand wrapper around `getFeatureFlag`.
- `isFeatureEnabled(name)`: uses the current tenant context when one is loaded.

Current agent UI surfaces are gated by the `agents.matched-ui-v1` flag to prevent
exposing unfinished experiences.
