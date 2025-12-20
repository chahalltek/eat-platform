import { describe, expect, it } from "vitest";

import { assertLlmSafetyConfig, getLlmSafetyStatus, LLMSafetyConfigError } from "./config";

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  REQUIRE_LLM_SAFETY: "true",
};

describe("LLM safety config", () => {
  it("treats a fully configured environment as safe", () => {
    const status = getLlmSafetyStatus({ ...baseEnv });

    expect(status.ok).toBe(true);
    expect(status.issues).toEqual([]);
    expect(assertLlmSafetyConfig({ ...baseEnv })).toMatchObject({ ok: true });
  });

  it("flags missing required safety guardrails", () => {
    const env = { ...baseEnv };
    delete env.REQUIRE_LLM_SAFETY;

    const status = getLlmSafetyStatus(env);
    expect(status.ok).toBe(false);
    expect(status.issues.join(" ")).toContain("REQUIRE_LLM_SAFETY");
    expect(() => assertLlmSafetyConfig(env)).toThrow(LLMSafetyConfigError);
  });

  it("detects disabled redaction and allowlists", () => {
    const env = {
      ...baseEnv,
      LLM_REDACTION_ENABLED: "false",
      LLM_AGENT_ALLOWLIST_DISABLED: "true",
    };

    const status = getLlmSafetyStatus(env);

    expect(status.ok).toBe(false);
    expect(status.issues).toEqual([
      "LLM redaction is disabled; outbound prompts cannot be sent safely.",
      "Agent allowlists are disabled; enable them to prevent unapproved LLM calls.",
    ]);
  });

  it("blocks prompt logging without redaction in production only", () => {
    const prodEnv = {
      ...baseEnv,
      LLM_PROMPT_LOGGING_ENABLED: "true",
      LLM_PROMPT_LOG_REDACTION_ENABLED: "false",
    };

    const prodStatus = getLlmSafetyStatus(prodEnv);
    expect(prodStatus.ok).toBe(false);
    expect(prodStatus.issues).toContain("Prompt logging is enabled without redaction in production.");

    const devEnv = { ...prodEnv, NODE_ENV: "development" };
    const devStatus = getLlmSafetyStatus(devEnv);
    expect(devStatus.ok).toBe(true);
  });

  it("applies legacy disable flags and explicit enable flags correctly", () => {
    const env = {
      ...baseEnv,
      LLM_REDACTION_DISABLED: "true",
      LLM_AGENT_ALLOWLIST_ENABLED: "true",
      LLM_PROMPT_LOG_REDACTION_ENABLED: "true",
    };

    const status = getLlmSafetyStatus(env);

    expect(status.redactionEnabled).toBe(false);
    expect(status.allowlistEnabled).toBe(true);
    expect(status.issues).toContain("LLM redaction is disabled; outbound prompts cannot be sent safely.");
  });

  it("defaults environment to development when NODE_ENV is missing", () => {
    const status = getLlmSafetyStatus({ ...baseEnv, NODE_ENV: undefined });

    expect(status.environment).toBe("development");
  });
});
