export type DecisionStreamAction = "VIEWED" | "SHORTLISTED" | "REMOVED" | "FAVORITED";

import type { TradeoffDeclaration } from "@/lib/matching/tradeoffs";

export type DecisionStreamItem = {
  streamId?: string | null;
  jobId: string;
  candidateId: string;
  action: DecisionStreamAction;
  label?: string;
  confidence?: number;
  confidenceBand?: "HIGH" | "MEDIUM" | "LOW";
  outcome?: string;
  details?: Record<string, unknown>;
};

<<<<<<< ours
function normalizeConfidenceScore(score?: number): number {
  const numeric = typeof score === "number" ? Number(score) : Number.NaN;
  if (Number.isFinite(numeric)) {
    return Math.min(10, Math.max(0, Number(numeric.toFixed(2))));
  }
  return 5;
}

export async function createDecisionStream(jobId: string): Promise<string | null> {
=======
export async function createDecisionStream(jobId: string, tradeoffs?: TradeoffDeclaration): Promise<string | null> {
>>>>>>> theirs
  try {
    const res = await fetch("/api/decision-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, tradeoffs }),
    });

    if (!res.ok) {
      throw new Error(`DecisionStream init failed with status ${res.status}`);
    }

    const payload = (await res.json()) as { streamId?: unknown };
    return typeof payload.streamId === "string" ? payload.streamId : null;
  } catch (error) {
    console.warn("Failed to initialize decision stream", error);
    return null;
  }
}

export async function logDecisionStreamItem(item: DecisionStreamItem): Promise<void> {
  if (!item.streamId) return;

  try {
    const confidenceScore = normalizeConfidenceScore(item.confidence);

    await fetch("/api/decision-stream/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...item,
        confidence: confidenceScore,
      }),
    });
  } catch (error) {
    console.warn("Failed to log decision stream item", error);
  }
}
