export type AgentRunStatusValue = "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL";

export type SerializableLog = {
  id: string;
  agentName: string;
  startedAt: string;
  status: AgentRunStatusValue;
  userLabel: string;
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  errorMessage?: string | null;
  retryCount: number;
  retryOfId?: string | null;
  durationMs?: number | null;
  finishedAt?: string | null;
};
