# ETE-GTM-301 – Product Tiers

This document defines the sellable ETE SKUs as configuration and documentation only. It keeps the core codebase unified while making each tier legible for pricing and packaging discussions.

## SKU Framework

| Key | SKU Name | Included Capabilities | Excluded Capabilities | Target Buyer | Bullhorn Dependency |
| --- | --- | --- | --- | --- | --- |
| intelligenceCore | ETE Intelligence Core | MATCH, CONFIDENCE, EXPLAIN, SHORTLIST, Guardrails, Learning (tenant-only) | Benchmarks, Market signals, Forecasts, L2 agents, Strategic Copilot, Exec Portal | Talent data platform owners and matching pipeline teams | required |
| marketInsights | ETE Market Insights | Benchmarks, Market signals, Forecasts | MATCH, CONFIDENCE, EXPLAIN, SHORTLIST, Guardrails, Learning (tenant-only), L2 agents, Strategic Copilot, Exec Portal | Workforce strategy, TA analytics, and market intelligence leaders | required |
| execCopilot | ETE Executive Copilot | L2 agents, Strategic Copilot, Exec Portal | MATCH, CONFIDENCE, EXPLAIN, SHORTLIST, Guardrails, Learning (tenant-only), Benchmarks, Market signals, Forecasts | Executive sponsors who want packaged talent insights and actions | required |

## Capability Mapping

- **Intelligence Core:** MATCH, CONFIDENCE, EXPLAIN, SHORTLIST, Guardrails, Learning (tenant-only)
- **Market Insights:** Benchmarks, Market signals, Forecasts
- **Executive Copilot:** L2 agents, Strategic Copilot, Exec Portal

Each tier declares `bullhornDependency: "required"` to keep the Bullhorn integration assumption explicit.

## Tenant Entitlements (visibility only)

Expose tenant-level visibility (no enforcement yet) via configuration:

```ts
export const DEFAULT_TENANT_ENTITLEMENTS = {
  intelligenceCore: true,
  marketInsights: false,
  execCopilot: false,
};
```

These keys align directly to the tier definitions in `src/config/productTiers.ts` and can be toggled per tenant without forking code paths.
