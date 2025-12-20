# LLM Data Handling & Privacy Guardrails

ETE treats the LLM as a stateless reasoning engine. The only supported path for invoking models is the AI gateway at `src/server/ai/gateway.ts` via `callLLM`, which orchestrates safety controls before and after a provider call.

## Enforcement pipeline
- **Allowlisted context only:** Inputs are normalized with `buildSafeLLMContext` and the `SafeLLMContext` allowlist to prevent unvetted fields from reaching prompts.
- **Redaction before send:** `redactAny` scrubs emails, phone numbers, and other secrets prior to outbound requests. The OpenAI adapter repeats the scrub on the payload it sends.
- **Size limits and truncation:** `enforceLimits` trims oversized fields (job descriptions, skills, summaries, free text) so raw documents are not forwarded in full.
- **Gateway-only model access:** `callLLM` resolves tenant model permissions, enforces authentication, and blocks calls when the tenant is not allowed to use the requested provider/model.
- **Logging defaults:** Prompt/response logging is disabled in production. When explicitly enabled for debugging, only redacted payloads are stored and logs must carry a TTL.
- **Tenant isolation:** Tenant ID is required for gateway calls; any caches or stores used for AI are scoped per-tenant and must not mix contexts across tenants.
- **Exports are gated:** CSV/clipboard/email table exports remain permissioned and auditable; AI-assisted outputs cannot bypass the RBAC/audit requirements for exports.

## Developer rules
- **No bypasses:** Do not call OpenAI (or any provider) directly outside `OpenAIChatAdapter`, and do not use the adapter outside the gateway pipeline.
- **Allowlist-first:** When a prompt needs a new field, add it to `SafeLLMContext` and `buildSafeLLMContext` before wiring it into prompts.
- **Never send raw sensitive data:** Do not pass full resumes, freeform recruiter notes, emails/phone numbers/addresses, SSN/DOB, or credentials into prompts. Redact or summarize first and keep context minimal.

See also:
- `src/server/ai/gateway.ts` — entry point for all LLM calls and audit flow.
- `src/server/ai/openaiClient.ts` — provider adapter that re-scrubs outbound content.
- `src/lib/llm.ts` — shared LLM utilities referenced by the gateway and adapters.
- Safety helpers in `src/server/ai/safety/*` (`safeContext`, `redact`, `limits`) — allowlist, redaction, and size enforcement.
