import { describe, expect, it } from "vitest";

import {
  enforcePreviewProdSecretGuard,
  getAzureOpenAIApiKey,
  getOpenAIApiKey,
} from "./secrets";

describe("enforcePreviewProdSecretGuard", () => {
  it("blocks production secrets in preview mode by default", () => {
    const env = {
      SECURITY_MODE: "preview",
      SAMPLE_PROD_SECRET: "secret",
    } as NodeJS.ProcessEnv;

    expect(() => enforcePreviewProdSecretGuard(env)).toThrow(
      /Production secrets are not allowed when SECURITY_MODE=preview/,
    );
  });

  it("allows explicit opt-in to production secrets", () => {
    const env = {
      SECURITY_MODE: "preview",
      SAMPLE_PROD_SECRET: "secret",
      ALLOW_PROD_SECRETS: "true",
    } as NodeJS.ProcessEnv;

    expect(() => enforcePreviewProdSecretGuard(env)).not.toThrow();
  });

  it("ignores production secrets outside preview mode", () => {
    const env = {
      SECURITY_MODE: "production",
      SAMPLE_PROD_SECRET: "secret",
    } as NodeJS.ProcessEnv;

    expect(() => enforcePreviewProdSecretGuard(env)).not.toThrow();
  });
});

describe("secret readers", () => {
  it("returns the configured OpenAI API keys from the provided env", () => {
    const env = {
      OPENAI_API_KEY: "primary",
      AZURE_OPENAI_API_KEY: "azure",
    } as NodeJS.ProcessEnv;

    expect(getOpenAIApiKey(env)).toBe("primary");
    expect(getAzureOpenAIApiKey(env)).toBe("azure");
  });
});
