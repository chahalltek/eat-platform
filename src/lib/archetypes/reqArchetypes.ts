import type { RuaLLMResponse } from "@/lib/agents/contracts/ruaContract";

export type ReqArchetypeId =
  | "urgent_backfill"
  | "stretch_hire"
  | "cost_constrained"
  | "high_risk_high_upside"
  | "standard";

export type ReqArchetypeDefinition = {
  id: ReqArchetypeId;
  label: string;
  defaultTradeoff: string;
  confidenceRange: { label: string; min: number; max: number };
  explainCue: string;
};

export type ReqArchetypeAssignment = {
  id: ReqArchetypeId;
  source: "auto" | "manual";
  reason?: string;
  confidence?: number;
};

const archetypeLibrary: Record<ReqArchetypeId, ReqArchetypeDefinition> = {
  urgent_backfill: {
    id: "urgent_backfill",
    label: "Urgent backfill",
    defaultTradeoff: "Favor speed and coverage to restore capacity quickly.",
    confidenceRange: { label: "Expect medium confidence due to time pressure", min: 0.55, max: 0.8 },
    explainCue: "Highlight immediate availability and ability to stabilize the team.",
  },
  stretch_hire: {
    id: "stretch_hire",
    label: "Stretch hire",
    defaultTradeoff: "Bet on upside while keeping a clear quality bar and support plan.",
    confidenceRange: { label: "Expect mixed confidence while screening for potential", min: 0.5, max: 0.85 },
    explainCue: "Emphasize trajectory, coachability, and signal for growth.",
  },
  cost_constrained: {
    id: "cost_constrained",
    label: "Cost-constrained role",
    defaultTradeoff: "Optimize for value within budget while protecting must-haves.",
    confidenceRange: { label: "Expect medium confidence as budget tightens options", min: 0.45, max: 0.75 },
    explainCue: "Call out efficiency, trainability, and lower-risk bets.",
  },
  high_risk_high_upside: {
    id: "high_risk_high_upside",
    label: "High-risk / high-upside",
    defaultTradeoff: "Balance upside with explicit risks and mitigation steps.",
    confidenceRange: { label: "Expect a wider confidence swing; scrutinize signals", min: 0.4, max: 0.85 },
    explainCue: "Name the upside while flagging known risks and mitigation.",
  },
  standard: {
    id: "standard",
    label: "Standard search",
    defaultTradeoff: "Balanced quality and coverage with recruiter judgment.",
    confidenceRange: { label: "Expect normal confidence envelope", min: 0.6, max: 0.9 },
    explainCue: "Default framing with no special constraints.",
  },
};

export function getArchetypeDefinition(id?: ReqArchetypeId | null): ReqArchetypeDefinition | null {
  if (!id) return null;
  return archetypeLibrary[id] ?? null;
}

export function describeAssignment(
  assignment?: ReqArchetypeAssignment | null,
): (ReqArchetypeAssignment & ReqArchetypeDefinition) | null {
  if (!assignment) return null;
  const definition = getArchetypeDefinition(assignment.id);
  if (!definition) return null;

  return { ...definition, ...assignment } satisfies ReqArchetypeAssignment & ReqArchetypeDefinition;
}

function matchAny(target: string, keywords: string[]): boolean {
  return keywords.some((keyword) => target.includes(keyword));
}

export function suggestReqArchetype(input: {
  intent?: Partial<RuaLLMResponse> | null;
  rawDescription?: string | null;
}): ReqArchetypeAssignment & ReqArchetypeDefinition {
  const text = [
    input.intent?.priority,
    input.intent?.teamContext,
    input.intent?.responsibilitiesSummary,
    input.intent?.status,
    input.intent?.employmentType,
    input.rawDescription,
  ]
    .filter(Boolean)
    .join(" \n")
    .toLowerCase();

  const ambiguityScore = typeof input.intent?.ambiguityScore === "number" ? input.intent.ambiguityScore : null;

  if (
    matchAny(text, ["backfill", "replacement", "leave coverage", "resignation", "coverage gap"]) ||
    matchAny(text, ["urgent", "asap", "immediately", "immediate start"]) ||
    (input.intent?.priority ?? "").toLowerCase().includes("urgent")
  ) {
    return {
      ...archetypeLibrary.urgent_backfill,
      source: "auto",
      reason: "Detected urgent/backfill language in the intake notes.",
      confidence: 0.82,
    } satisfies ReqArchetypeAssignment & ReqArchetypeDefinition;
  }

  if (
    matchAny(text, ["contract", "part-time", "fractional", "hourly", "rate cap", "tight budget", "budget"]) ||
    (input.intent?.employmentType ?? "").toLowerCase().includes("contract")
  ) {
    return {
      ...archetypeLibrary.cost_constrained,
      source: "auto",
      reason: "Budget, contract, or cost-control language detected.",
      confidence: 0.78,
    } satisfies ReqArchetypeAssignment & ReqArchetypeDefinition;
  }

  if (
    (ambiguityScore !== null && ambiguityScore >= 0.6) ||
    matchAny(text, ["ambiguous", "0->1", "greenfield", "turnaround", "uncertain", "risky", "v0", "new market"])
  ) {
    return {
      ...archetypeLibrary.high_risk_high_upside,
      source: "auto",
      reason: "High ambiguity or risk-upside signals detected in the intake.",
      confidence: 0.7,
    } satisfies ReqArchetypeAssignment & ReqArchetypeDefinition;
  }

  if (
    matchAny(text, ["player-coach", "first hire", "first engineer", "wear many hats", "build and lead", "stretch", "hybrid ic"])
  ) {
    return {
      ...archetypeLibrary.stretch_hire,
      source: "auto",
      reason: "Stretch / hybrid IC-manager signals detected.",
      confidence: 0.75,
    } satisfies ReqArchetypeAssignment & ReqArchetypeDefinition;
  }

  return {
    ...archetypeLibrary.standard,
    source: "auto",
    reason: "No strong archetype signal detected; using standard profile.",
    confidence: 0.5,
  } satisfies ReqArchetypeAssignment & ReqArchetypeDefinition;
}

export const reqArchetypeIds = Object.keys(archetypeLibrary) as ReqArchetypeId[];
export const reqArchetypeIdTuple = reqArchetypeIds as [ReqArchetypeId, ...ReqArchetypeId[]];

export function archetypeOptions(): Array<ReqArchetypeDefinition> {
  return reqArchetypeIds.map((id) => archetypeLibrary[id]);
}
