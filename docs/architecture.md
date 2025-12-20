# Architecture and Internal References

This folder collects internal guides that document how we build and operate ETE. Use these as entry points when adding new features or patterns.

- [Database safety](./db-safety.md) — patterns and checklists for safe schema migrations and data changes.
- [Deployment health](./deployment-health.md) — guidance for monitoring releases and responding to incidents.
- [API map](./architecture/api-map.md) — route groups, ownership (EAT vs. ETE), and guidance on new endpoints.
- [EAT vs. ETE blueprint](./architecture/eat-vs-ete.md) — platform-first intent, current split, and realignment plan.
- [Marketplace scoring](./msa-scoring.md) — overview of the MSA scoring model and its inputs.
- [TanStack Table usage](./tables.md) — how we structure tables with TanStack Table, the `ETETable` abstraction, and testing patterns.

## LLM gateway & safety pipeline
- All model access flows through `callLLM` in `src/server/ai/gateway.ts`; direct provider calls are not permitted.
- Inputs are normalized with `buildSafeLLMContext` (allowlist), scrubbed with `redactAny`, trimmed by `enforceLimits`, then sent via `OpenAIChatAdapter` for a final scrub before the provider request.
- Tenant checks and audit events are enforced in the gateway, and prompt logging remains off by default in production (redacted with TTL when enabled for debugging).
- Refer to [LLM data handling & privacy guardrails](./security/llm-guardrails.md) for the complete policy and developer rules.
