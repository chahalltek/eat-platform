# Feature flags

Feature flag checks are centralized in `src/lib/featureFlags.ts`. The helper
functions there safely handle missing database tables and return booleans.

- `getFeatureFlag(tenantId, name)`: resolves the flag for a specific tenant.
- `isEnabled(tenantId, name)`: shorthand wrapper around `getFeatureFlag`.
- `isFeatureEnabled(name)`: uses the current tenant context when one is loaded.
- Environment defaults can be set per deployment via `DEPLOYMENT_MODE`
  presets or a `DEFAULT_FEATURE_FLAGS` comma-separated list (e.g.
  `agents=true,scoring=false`). These defaults are applied before plan-based
  fallbacks.

Current agent UI surfaces are gated by the `agents.matched-ui-v1` flag to prevent
exposing unfinished experiences.
