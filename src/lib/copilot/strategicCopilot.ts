import type {
  BenchmarkMetric,
  BenchmarkRelease,
  PrismaClient,
  TenantLearningSignal,
} from "@/server/db/prisma";

import { callLLM } from "@/lib/llm";
import type { OpenAIAdapter } from "@/lib/llm/openaiAdapter";
import { prisma } from "@/server/db/prisma";
import type { MarketSignals } from "@/lib/market/marketSignals";
import type { TimeToFillRisk } from "@/lib/forecast/timeToFillRisk";

export type CopilotRequest = {
  tenantId: string;
  userId: string;
  query: string;
  scope?: { roleFamily?: string; horizonDays?: 30 | 60 | 90 };
};

export type CopilotEvidence = {
  type: "benchmark" | "forecast" | "mqi" | "market_signal" | "l2_result";
  label: string;
  id?: string;
};

export type CopilotResponse = {
  answer: string;
  bullets: string[];
  confidence: "low" | "medium" | "high";
  evidence: CopilotEvidence[];
  caveats: string[];
};

export type EvidencePack = {
  benchmarks: (BenchmarkRelease & { metrics: BenchmarkMetric[] }) | null;
  forecasts: TimeToFillRisk[];
  marketSignals: MarketSignals | null;
  mqiSignals: TenantLearningSignal[];
  l2Results: TenantLearningSignal[];
};

function uniqueEvidence(entries: CopilotEvidence[]) {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = `${entry.type}:${entry.id ?? entry.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildEvidenceReferences(pack: EvidencePack): CopilotEvidence[] {
  const evidence: CopilotEvidence[] = [];

  if (pack.benchmarks) {
    evidence.push({
      type: "benchmark",
      label: `Benchmark release ${pack.benchmarks.version}`,
      id: pack.benchmarks.id,
    });
  }

  for (const forecast of pack.forecasts) {
    const label = forecast.jobTitle ? `Forecast for ${forecast.jobTitle}` : `Forecast for ${forecast.jobId}`;
    evidence.push({ type: "forecast", label, id: forecast.jobId });
  }

  if (pack.marketSignals) {
    evidence.push({ type: "market_signal", label: pack.marketSignals.label });
  }

  for (const signal of pack.mqiSignals) {
    evidence.push({
      type: "mqi",
      label: `MQI signal for ${signal.roleFamily}`,
      id: signal.id,
    });
  }

  for (const signal of pack.l2Results) {
    evidence.push({
      type: "l2_result",
      label: `L2 result for ${signal.roleFamily}`,
      id: signal.id,
    });
  }

  return uniqueEvidence(evidence);
}

function describeEvidenceGaps(pack: EvidencePack) {
  const caveats: string[] = [];

  if (!pack.benchmarks) {
    caveats.push("No published benchmark release was found for this query.");
  }

  if (!pack.marketSignals) {
    caveats.push("Market signals are unavailable right now.");
  }

  if (pack.forecasts.length === 0) {
    caveats.push("No forecasts were available for the current scope.");
  }

  if (pack.mqiSignals.length === 0) {
    caveats.push("No MQI signals matched this scope.");
  }

  if (pack.l2Results.length === 0) {
    caveats.push("No L2 results were located for this audience.");
  }

  return caveats;
}

function coerceConfidence(
  value: string | undefined,
  evidenceCount: number,
  caveats: string[],
  missingEvidenceCount: number,
) {
  const normalized = value === "high" || value === "medium" || value === "low" ? value : "medium";

  if (evidenceCount <= 1 || caveats.length >= 3 || missingEvidenceCount > 0) {
    return "low" as const;
  }

  return normalized as CopilotResponse["confidence"];
}

export function extractJsonPayload(raw: string) {
  try {
    return JSON.parse(raw) as Partial<CopilotResponse>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]) as Partial<CopilotResponse>;
    } catch {
      return null;
    }
  }
}

function normalizeBullets(bullets: unknown) {
  if (!Array.isArray(bullets)) return [] as string[];
  return bullets.map((bullet) => String(bullet)).filter((bullet) => bullet.trim().length > 0);
}

function sanitizeCaveats(caveats: unknown, gaps: string[]) {
  const provided = Array.isArray(caveats) ? caveats.map((item) => String(item)) : [];
  const merged = [...provided, ...gaps].filter((entry) => entry.trim().length > 0);

  return Array.from(new Set(merged));
}

export async function generateStrategicCopilotResponse({
  request,
  evidencePack,
  adapter,
}: {
  request: CopilotRequest;
  evidencePack: EvidencePack;
  adapter?: OpenAIAdapter;
}): Promise<CopilotResponse> {
  const evidence = buildEvidenceReferences(evidencePack);
  const missingEvidence = describeEvidenceGaps(evidencePack);

  if (evidence.length === 0) {
    return {
      answer: "I could not find enough vetted ETE evidence to answer this question yet.",
      bullets: [],
      confidence: "low",
      evidence,
      caveats: missingEvidence,
    } satisfies CopilotResponse;
  }

  const fallbackAnswer =
    "Here is what the ETE signals indicate. These takeaways avoid actions on Bullhorn or ATS data and stay within the provided evidence.";

  const modelContext = {
    query: request.query,
    scope: request.scope ?? {},
    evidenceList: evidence,
    evidencePack: {
      benchmarks: evidencePack.benchmarks,
      forecasts: evidencePack.forecasts.slice(0, 10),
      marketSignals: evidencePack.marketSignals,
      mqiSignals: evidencePack.mqiSignals.slice(0, 10),
      l2Results: evidencePack.l2Results.slice(0, 10),
    },
  };

  const systemPrompt = [
    "You are the ETE Strategic Copilot.",
    "Answer strategy questions using only the provided evidence.",
    "Never invent data; if evidence is thin, set confidence to low and explain the gaps.",
    "Do not take actions on ATS/Bullhorn records; only suggest next steps.",
    "Always return JSON with keys answer, bullets, confidence, evidence, caveats.",
    "Evidence entries must cite the labels provided in evidenceList.",
  ].join(" ");

  let parsed: Partial<CopilotResponse> | null = null;

  try {
    const raw = await callLLM({
      systemPrompt,
      userPrompt: `Respond with JSON to this prompt: ${JSON.stringify(modelContext, null, 2)}`,
      agent: "strategic-copilot",
      adapter,
    });

    parsed = extractJsonPayload(raw);
  } catch (error) {
    console.error("[strategic-copilot] LLM call failed", error);
  }

  const bullets = normalizeBullets(parsed?.bullets);
  const caveats = sanitizeCaveats(parsed?.caveats, missingEvidence);
  const confidence = coerceConfidence(parsed?.confidence, evidence.length, caveats, missingEvidence.length);
  const answer = parsed?.answer?.trim().length ? parsed.answer.trim() : fallbackAnswer;

  return {
    answer,
    bullets: bullets.length > 0 ? bullets : [answer],
    confidence,
    evidence,
    caveats,
  } satisfies CopilotResponse;
}

export async function recordCopilotAudit({
  tenantId,
  userId,
  query,
  response,
  evidence,
  client = prisma,
}: {
  tenantId: string;
  userId: string;
  query: string;
  response: CopilotResponse;
  evidence: CopilotEvidence[];
  client?: PrismaClient;
}) {
  return client.copilotAudit.create({
    data: {
      tenantId,
      userId,
      query,
      response,
      evidence,
    },
  });
}
