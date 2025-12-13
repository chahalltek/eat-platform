import { PRODUCT_TIERS, type ProductTierKey } from "./productTiers";

export type PricingDimensionKey =
  | "jobsAnalyzed"
  | "candidatesEvaluated"
  | "agentRuns"
  | "copilotQueries"
  | "benchmarkAccess";

export type PricingDimension = {
  key: PricingDimensionKey;
  label: string;
  unit: "count" | "boolean";
  description: string;
  enforcement: "visibilityOnly";
};

export const PRICING_DIMENSIONS: PricingDimension[] = [
  {
    key: "jobsAnalyzed",
    label: "Jobs analyzed / month",
    unit: "count",
    description:
      "Open or active job orders processed through MATCH/CONFIDENCE/EXPLAIN/SHORTLIST in a given month.",
    enforcement: "visibilityOnly",
  },
  {
    key: "candidatesEvaluated",
    label: "Candidates evaluated / month",
    unit: "count",
    description: "Candidate profiles scored, screened, or short-listed per month.",
    enforcement: "visibilityOnly",
  },
  {
    key: "agentRuns",
    label: "Agent runs",
    unit: "count",
    description: "Discrete executions of L2 agents regardless of downstream actions taken.",
    enforcement: "visibilityOnly",
  },
  {
    key: "copilotQueries",
    label: "Copilot queries",
    unit: "count",
    description: "Natural language prompts to Copilot that invoke ETE models or actions.",
    enforcement: "visibilityOnly",
  },
  {
    key: "benchmarkAccess",
    label: "Benchmark access",
    unit: "boolean",
    description: "Toggle that unlocks access to benchmark and market insight content.",
    enforcement: "visibilityOnly",
  },
];

export type SkuPricing = {
  skuName: string;
  billableMetrics: PricingDimensionKey[];
  nonBillableMetrics: PricingDimensionKey[];
  notes?: string;
};

export const SKU_PRICING: Record<ProductTierKey, SkuPricing> = {
  intelligenceCore: {
    skuName: PRODUCT_TIERS.intelligenceCore.skuName,
    billableMetrics: ["jobsAnalyzed", "candidatesEvaluated", "agentRuns"],
    nonBillableMetrics: ["copilotQueries", "benchmarkAccess"],
    notes:
      "Volumetric pricing tied to matching throughput; agent runs priced when used for guardrails or enrich/learn cycles.",
  },
  marketInsights: {
    skuName: PRODUCT_TIERS.marketInsights.skuName,
    billableMetrics: ["benchmarkAccess"],
    nonBillableMetrics: [
      "jobsAnalyzed",
      "candidatesEvaluated",
      "agentRuns",
      "copilotQueries",
    ],
    notes: "Benchmarks are the paid unlock; insights consumption is read-only without per-unit billing.",
  },
  execCopilot: {
    skuName: PRODUCT_TIERS.execCopilot.skuName,
    billableMetrics: ["agentRuns", "copilotQueries"],
    nonBillableMetrics: [
      "jobsAnalyzed",
      "candidatesEvaluated",
      "benchmarkAccess",
    ],
    notes: "Pricing follows conversational + automation consumption; underlying data processing is bundled.",
  },
};
