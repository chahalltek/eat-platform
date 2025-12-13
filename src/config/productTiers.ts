export type BullhornDependency = "required";

export type ProductTierKey =
  | "intelligenceCore"
  | "marketInsights"
  | "execCopilot";

export type ProductTier = {
  skuName: string;
  includedCapabilities: string[];
  excludedCapabilities: string[];
  targetBuyer: string;
  bullhornDependency: BullhornDependency;
};

export const PRODUCT_TIERS: Record<ProductTierKey, ProductTier> = {
  intelligenceCore: {
    skuName: "ETE Intelligence Core",
    includedCapabilities: [
      "MATCH",
      "CONFIDENCE",
      "EXPLAIN",
      "SHORTLIST",
      "Guardrails",
      "Learning (tenant-only)",
    ],
    excludedCapabilities: [
      "Benchmarks",
      "Market signals",
      "Forecasts",
      "L2 agents",
      "Strategic Copilot",
      "Exec Portal",
    ],
    targetBuyer: "Talent data platform owners and matching pipeline teams",
    bullhornDependency: "required",
  },
  marketInsights: {
    skuName: "ETE Market Insights",
    includedCapabilities: [
      "Benchmarks",
      "Market signals",
      "Forecasts",
    ],
    excludedCapabilities: [
      "MATCH",
      "CONFIDENCE",
      "EXPLAIN",
      "SHORTLIST",
      "Guardrails",
      "Learning (tenant-only)",
      "L2 agents",
      "Strategic Copilot",
      "Exec Portal",
    ],
    targetBuyer: "Workforce strategy, TA analytics, and market intelligence leaders",
    bullhornDependency: "required",
  },
  execCopilot: {
    skuName: "ETE Executive Copilot",
    includedCapabilities: [
      "L2 agents",
      "Strategic Copilot",
      "Exec Portal",
    ],
    excludedCapabilities: [
      "MATCH",
      "CONFIDENCE",
      "EXPLAIN",
      "SHORTLIST",
      "Guardrails",
      "Learning (tenant-only)",
      "Benchmarks",
      "Market signals",
      "Forecasts",
    ],
    targetBuyer: "Executive sponsors who want packaged talent insights and actions",
    bullhornDependency: "required",
  },
};

export type TenantEntitlements = Record<ProductTierKey, boolean>;

export const DEFAULT_TENANT_ENTITLEMENTS: TenantEntitlements = {
  intelligenceCore: true,
  marketInsights: false,
  execCopilot: false,
};
