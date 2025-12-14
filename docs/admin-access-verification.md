# Admin access verification steps

Use this checklist to manually confirm admin panel routing and tenant-level guardrails access.

1. **Start the app**
   - Run `npm run dev`.
   - Open http://localhost:3000 in the browser.

2. **Platform admin access**
   - Sign in as a platform admin (role `ADMIN`).
   - Navigate to `/admin` and confirm the Platform health dashboard renders (no "Admin access required" banner).

3. **Non-admin guard**
   - Sign in as a recruiter or other non-admin role.
   - Visit `/admin` and verify you are redirected to `/` or shown the "Admin access required" message.

4. **Tenant guardrails page**
   - While signed in as a tenant admin or platform admin, visit `/admin/tenant/{tenantId}/guardrails`.
   - Confirm the "Guardrails presets" page loads for the requested tenant.
   - Switch to a non-admin account and revisit the page; ensure the "Admin access required" callout is shown instead of the presets UI.

5. **API enforcement sanity check (optional)**
   - With an admin account, call `GET /api/admin/tenant/{tenantId}/guardrails/performance` and confirm a 200 response.
   - With a non-admin account, repeat the call and confirm a 403 with `{ "error": "Forbidden" }`.
