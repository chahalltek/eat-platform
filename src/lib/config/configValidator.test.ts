import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { formatConfigErrors, getAppConfig, validateConfig } from "./configValidator";

const baseEnv = {
  NODE_ENV: "production",
  APP_ENV: "production",
  DATABASE_URL: "postgresql://prod.db.example.com/main",
  SSO_ISSUER_URL: "https://sso.example.com",
  SSO_CLIENT_ID: "client-id",
  SSO_CLIENT_SECRET: "client-secret",
  BILLING_PROVIDER_SECRET_KEY: "billing-key",
  BILLING_WEBHOOK_SECRET: "billing-webhook",
  TENANT_MODE: "multi",
};

describe("validateConfig", () => {
  it("accepts a fully configured production environment", () => {
    const result = validateConfig(baseEnv);

    expect(result).toMatchObject({
      NODE_ENV: "production",
      APP_ENV: "production",
      TENANT_MODE: "multi",
    });
  });

  it("throws a helpful error when SSO configuration is missing in production", () => {
    const env = { ...baseEnv, SSO_CLIENT_SECRET: undefined } as NodeJS.ProcessEnv;

    expect(() => validateConfig(env)).toThrow(/SSO_CLIENT_SECRET is required in production to enable SSO/);
  });

  it("allows staging configurations without production-only requirements", () => {
    const env = {
      ...baseEnv,
      APP_ENV: "staging",
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://staging.example.com/db",
      SSO_ISSUER_URL: undefined,
      SSO_CLIENT_ID: undefined,
      SSO_CLIENT_SECRET: undefined,
      BILLING_PROVIDER_SECRET_KEY: undefined,
      BILLING_WEBHOOK_SECRET: undefined,
      TENANT_MODE: undefined,
    } as NodeJS.ProcessEnv;

    const config = validateConfig(env);

    expect(config.APP_ENV).toBe("staging");
  });

  it("requires a tenant mode to be explicitly set for production", () => {
    const env = { ...baseEnv, TENANT_MODE: undefined } as NodeJS.ProcessEnv;

    expect(() => validateConfig(env)).toThrow(
      "Invalid configuration: TENANT_MODE: TENANT_MODE must be explicitly set to 'single' or 'multi' in production",
    );
  });

  it("throws when NODE_ENV does not align with production APP_ENV", () => {
    const env = { ...baseEnv, NODE_ENV: "development" } as NodeJS.ProcessEnv;

    expect(() => validateConfig(env)).toThrow("NODE_ENV must be 'production' when APP_ENV is production");
  });

  it("rejects unsafe database URLs in production", () => {
    const env = {
      ...baseEnv,
      DATABASE_URL: "postgresql://localhost:5432/dev",
    } as NodeJS.ProcessEnv;

    expect(() => validateConfig(env)).toThrow(
      "Invalid configuration: DATABASE_URL: Production deployments must not point to localhost databases",
    );
  });

  it("validates billing secrets are present in production", () => {
    const env = { ...baseEnv, BILLING_PROVIDER_SECRET_KEY: undefined } as NodeJS.ProcessEnv;

    expect(() => validateConfig(env)).toThrow(/BILLING_PROVIDER_SECRET_KEY is required in production for billing safeguards/);
  });

  it("surfaces missing base environment variables", () => {
    expect(() => validateConfig({} as NodeJS.ProcessEnv)).toThrow(
      /NODE_ENV: Invalid option: expected one of "development"\|"production"\|"test"/,
    );
  });

  it("requires an explicit database URL when running in production", () => {
    expect(() =>
      validateConfig({
        NODE_ENV: "production",
        APP_ENV: "production",
      } as NodeJS.ProcessEnv),
    ).toThrow("DATABASE_URL is required for production environments");
  });

  it("formats errors without a path as environment-level issues", () => {
    const error = new ZodError([
      { code: "custom", message: "root failure", path: [] },
    ]);

    expect(formatConfigErrors(error)).toBe("environment: root failure");
  });

  it("validates using provided env without caching when overriding process.env", () => {
    const config = getAppConfig({ ...baseEnv, APP_ENV: "production" });

    expect(config.SSO_CLIENT_ID).toBe("client-id");
  });

  it("caches the validated process.env configuration", () => {
    const originalEnv = { ...process.env };
    Object.assign(process.env, baseEnv);

    const first = getAppConfig();
    process.env.SSO_CLIENT_ID = "mutated";
    const second = getAppConfig();

    expect(second).toBe(first);

    Object.assign(process.env, originalEnv);
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
  });
});
