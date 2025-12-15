# Contributing to EAT

Thank you for helping improve the EAT platform. Please follow the guidance below to keep changes consistent and safe.

## API Design & Routing Rules
- All new API routes must align with the API lane model described in [docs/architecture/api-overview.md](docs/architecture/api-overview.md).
- Contributors must identify the intended API lane (Agent, Domain, Platform) when introducing new endpoints.
- Agent logic must not be embedded in domain or platform routes.
- Platform/control-plane routes require explicit authorization checks.
- Legacy routes are allowed only when documented in the API Overview.

If you are unsure where a new route belongs, update the API Overview document before adding the route.

## Pull Request Checklist
- Use the repository [PR template](.github/pull_request_template.md) for every change.
- Confirm the "Layout lint (admin)" checks:
  - No horizontal scroll on admin pages
  - Cards/titles wrap or clamp
  - Long tokens break safely
  - Run `npm run e2e:admin-layout` to validate admin layout basics
