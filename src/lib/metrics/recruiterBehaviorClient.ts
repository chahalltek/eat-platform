export type RecruiterBehaviorAction =
  | "CANDIDATE_OPEN"
  | "EXPLANATION_EXPANDED"
  | "SHORTLIST_OVERRIDE"
  | "DECISION_TIME";

export type RecruiterBehaviorEvent = {
  action: RecruiterBehaviorAction;
  jobId?: string;
  matchId?: string;
  candidateId?: string;
  confidence?: string | null;
  durationMs?: number;
  details?: Record<string, unknown>;
};

export async function logRecruiterBehavior(event: RecruiterBehaviorEvent) {
  try {
    await fetch("/api/metrics/recruiter-behavior", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (error) {
    console.warn("Failed to log recruiter behavior", error);
  }
}
