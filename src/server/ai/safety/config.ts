type BooleanLike = string | undefined;

function toBoolean(value: BooleanLike, defaultValue = false) {
  if (value === undefined) return defaultValue;

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export class LLMSafetyConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join(" "));
    this.name = "LLMSafetyConfigError";
  }
}

export type LlmSafetyStatus = {
  ok: boolean;
  environment: string;
  requireLlmSafety: boolean;
  redactionEnabled: boolean;
  allowlistEnabled: boolean;
  promptLoggingEnabled: boolean;
  promptLoggingRedacted: boolean;
  issues: string[];
};

export function getLlmSafetyStatus(env: NodeJS.ProcessEnv = process.env): LlmSafetyStatus {
  const requireLlmSafety = toBoolean(env.REQUIRE_LLM_SAFETY, false);
  const redactionEnabled =
    env.LLM_REDACTION_ENABLED !== undefined
      ? toBoolean(env.LLM_REDACTION_ENABLED, true)
      : !toBoolean(env.LLM_REDACTION_DISABLED, false);

  const allowlistEnabled =
    env.LLM_AGENT_ALLOWLIST_ENABLED !== undefined
      ? toBoolean(env.LLM_AGENT_ALLOWLIST_ENABLED, true)
      : !toBoolean(env.LLM_AGENT_ALLOWLIST_DISABLED, false);

  const promptLoggingEnabled = toBoolean(env.LLM_PROMPT_LOGGING_ENABLED, false);
  const promptLoggingRedacted =
    env.LLM_PROMPT_LOG_REDACTION_ENABLED !== undefined
      ? toBoolean(env.LLM_PROMPT_LOG_REDACTION_ENABLED, redactionEnabled)
      : redactionEnabled;

  const issues: string[] = [];

  if (!requireLlmSafety) {
    issues.push("REQUIRE_LLM_SAFETY must be set to true before calling LLMs.");
  }

  if (!redactionEnabled) {
    issues.push("LLM redaction is disabled; outbound prompts cannot be sent safely.");
  }

  if (!allowlistEnabled) {
    issues.push("Agent allowlists are disabled; enable them to prevent unapproved LLM calls.");
  }

  if (env.NODE_ENV === "production" && promptLoggingEnabled && !promptLoggingRedacted) {
    issues.push("Prompt logging is enabled without redaction in production.");
  }

  return {
    ok: issues.length === 0,
    environment: env.NODE_ENV ?? "development",
    requireLlmSafety,
    redactionEnabled,
    allowlistEnabled,
    promptLoggingEnabled,
    promptLoggingRedacted,
    issues,
  };
}

export function assertLlmSafetyConfig(env: NodeJS.ProcessEnv = process.env) {
  const status = getLlmSafetyStatus(env);

  if (!status.ok) {
    throw new LLMSafetyConfigError(status.issues);
  }

  return status;
}
