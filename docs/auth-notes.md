# Authentication Notes

## Current stubbed behavior
- `getCurrentUser()` (and helpers like `getCurrentUserId`, `getUserTenantId`, and `getUserRoles`) are currently hardcoded to return a static user identity. There is no real authentication or session validation in place.
- All API routes, admin pages, agents, and audit logging rely on `getCurrentUser()` for user context, so the stub is the single source of truth for identity today.

## Future replacement plan
- Swap the stub for a real provider in `src/lib/auth/identityProvider.ts`, updating only the `getCurrentUser()` implementation (and related helpers if needed).
- Candidate providers include NextAuth/Auth.js, Clerk, or a custom SSO integration; pick one and connect it behind `getCurrentUser()` so downstream callers remain unchanged.
- Preserve the existing surface: downstream code should continue to call `getCurrentUser()`/`getCurrentUserId()` rather than provider-specific APIs to keep the change centralized.

## Migration expectations
- Replacing the stub with a real identity provider should only require updating the logic in `getCurrentUser()` (and its helpers). No other code changes should be necessary if the function continues to return the expected user shape.
