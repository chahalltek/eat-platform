export type DecisionStreamAction = "VIEWED" | "SHORTLISTED" | "REMOVED" | "FAVORITED";

export type DecisionStreamItem = {
  streamId?: string | null;
  jobId: string;
  candidateId: string;
  action: DecisionStreamAction;
  label?: string;
  details?: Record<string, unknown>;
};

export async function createDecisionStream(jobId: string): Promise<string | null> {
  try {
    const res = await fetch("/api/decision-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
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
    await fetch("/api/decision-stream/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
  } catch (error) {
    console.warn("Failed to log decision stream item", error);
  }
}
