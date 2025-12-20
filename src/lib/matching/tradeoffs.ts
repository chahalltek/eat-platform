import { z } from "zod";

import { normalizeWeights, type MatchScoringWeights } from "@/lib/matching/scoringConfig";

export const tradeoffDeclarationSchema = z.object({
  speedQuality: z.enum(["speed", "quality"]),
  rateExperience: z.enum(["rate", "experience"]),
  availabilityFit: z.enum(["availability", "domain_fit"]),
  riskUpside: z.enum(["risk", "upside"]),
});

export type TradeoffDeclaration = z.infer<typeof tradeoffDeclarationSchema>;
export type TradeoffInput = Partial<TradeoffDeclaration> | null | undefined;

export const DEFAULT_TRADEOFF_DECLARATION: TradeoffDeclaration = {
  speedQuality: "quality",
  rateExperience: "experience",
  availabilityFit: "domain_fit",
  riskUpside: "risk",
};

function normalizeTradeoffInput(candidate: TradeoffInput): Partial<TradeoffDeclaration> {
  if (!candidate || typeof candidate !== "object") return {};
  return candidate;
}

export function resolveTradeoffs(defaults: TradeoffDeclaration, overrides?: TradeoffInput): TradeoffDeclaration {
  const merged = {
    ...defaults,
    ...normalizeTradeoffInput(overrides),
  } satisfies Partial<TradeoffDeclaration>;

  const parsed = tradeoffDeclarationSchema.safeParse(merged);
  return parsed.success ? parsed.data : defaults;
}

export function extractTradeoffDefaultsFromScoring(scoringConfig?: Record<string, unknown>): TradeoffDeclaration {
  const raw = (scoringConfig as { tradeoffs?: TradeoffInput } | undefined)?.tradeoffs;

  const candidate = raw && typeof raw === "object" && "defaults" in (raw as Record<string, unknown>)
    ? ((raw as { defaults?: TradeoffInput }).defaults as TradeoffInput)
    : raw;

  return resolveTradeoffs(DEFAULT_TRADEOFF_DECLARATION, candidate ?? undefined);
}

export function formatTradeoffDeclaration(tradeoffs: TradeoffDeclaration): string {
  const phrases = [
    tradeoffs.speedQuality === "speed" ? "Speed over quality" : "Quality over speed",
    tradeoffs.rateExperience === "rate" ? "Rate efficiency over experience" : "Experience over rate",
    tradeoffs.availabilityFit === "availability" ? "Availability over domain fit" : "Domain fit over availability",
    tradeoffs.riskUpside === "risk" ? "Risk controls over upside" : "Upside over risk controls",
  ];

  return phrases.join("; ");
}

export function applyTradeoffsToWeights(baseWeights: MatchScoringWeights, tradeoffs: TradeoffDeclaration): {
  weights: MatchScoringWeights;
  minScoreAdjustment: number;
  rationale: string[];
} {
  const bias = {
    skills: 0,
    seniority: 0,
    location: 0,
    candidateSignals: 0,
  } satisfies MatchScoringWeights;

  const rationale: string[] = [];
  let minScoreAdjustment = 0;

  if (tradeoffs.speedQuality === "speed") {
    bias.candidateSignals += 0.08;
    bias.skills -= 0.05;
    rationale.push("Prioritized speed over deep quality review (more signal weight).");
  } else {
    rationale.push("Quality favored over speed (skill weighting preserved).");
  }

  if (tradeoffs.rateExperience === "rate") {
    bias.seniority -= 0.06;
    bias.candidateSignals += 0.02;
    rationale.push("Rate sensitivity enabled (reduced experience weighting).");
  } else {
    rationale.push("Experience favored over rate sensitivity.");
  }

  if (tradeoffs.availabilityFit === "availability") {
    bias.location += 0.05;
    bias.skills -= 0.02;
    rationale.push("Availability emphasized over domain fit (location and signals nudged up).");
  } else {
    rationale.push("Domain fit prioritized over immediate availability.");
  }

  if (tradeoffs.riskUpside === "risk") {
    minScoreAdjustment += 5;
    bias.skills += 0.02;
    rationale.push("Risk controls tightened (slightly higher bar).");
  } else {
    minScoreAdjustment -= 5;
    bias.candidateSignals += 0.03;
    rationale.push("Upside-seeking bias enabled (stretch candidates allowed).");
  }

  const adjusted: MatchScoringWeights = normalizeWeights({
    skills: Math.max(0, baseWeights.skills + bias.skills),
    seniority: Math.max(0, baseWeights.seniority + bias.seniority),
    location: Math.max(0, baseWeights.location + bias.location),
    candidateSignals: Math.max(0, baseWeights.candidateSignals + bias.candidateSignals),
  });

  return { weights: adjusted, minScoreAdjustment, rationale };
}
