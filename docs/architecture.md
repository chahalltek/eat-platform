# Architecture and Internal References

This folder collects internal guides that document how we build and operate ETE. Use these as entry points when adding new features or patterns.

- [Database safety](./db-safety.md) — patterns and checklists for safe schema migrations and data changes.
- [Deployment health](./deployment-health.md) — guidance for monitoring releases and responding to incidents.
- [API map](./architecture/api-map.md) — route groups, ownership (EAT vs. ETE), and guidance on new endpoints.
- [EAT vs. ETE blueprint](./architecture/eat-vs-ete.md) — platform-first intent, current split, and realignment plan.
- [Marketplace scoring](./msa-scoring.md) — overview of the MSA scoring model and its inputs.
- [TanStack Table usage](./tables.md) — how we structure tables with TanStack Table, the `ETETable` abstraction, and testing patterns.
