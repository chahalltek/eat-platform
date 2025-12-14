const PROD_SECRET_PATTERN = /_PROD_/i;

type BooleanLike = string | undefined;

function toBoolean(value: BooleanLike, defaultValue = false): boolean {
  if (value === undefined) return defaultValue;

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function enforcePreviewProdSecretGuard(env: NodeJS.ProcessEnv = process.env) {
  const securityMode = env.SECURITY_MODE?.toLowerCase();
  const allowProdSecrets = toBoolean(env.ALLOW_PROD_SECRETS, false);

  if (securityMode !== "preview" || allowProdSecrets) {
    return;
  }

  const prodSecrets = Object.entries(env)
    .filter(([key, value]) => PROD_SECRET_PATTERN.test(key) && Boolean(value))
    .map(([key]) => key)
    .sort();

  if (prodSecrets.length > 0) {
    throw new Error(
      `Production secrets are not allowed when SECURITY_MODE=preview. Remove: ${prodSecrets.join(", ")}`,
    );
  }
}

enforcePreviewProdSecretGuard();

function readSecret(name: keyof NodeJS.ProcessEnv, env: NodeJS.ProcessEnv = process.env) {
  return env[name];
}

export function getAuthSessionSecret(env?: NodeJS.ProcessEnv) {
  return readSecret("AUTH_SESSION_SECRET", env);
}

export function getLocalAuthSessionSecret(env?: NodeJS.ProcessEnv) {
  return readSecret("AUTH_SESSION_SECRET_LOCAL", env);
}

export function getBullhornWebhookSecret(env?: NodeJS.ProcessEnv) {
  return readSecret("BULLHORN_WEBHOOK_SECRET", env);
}

export function getOpenAIApiKey(env?: NodeJS.ProcessEnv) {
  return readSecret("OPENAI_API_KEY", env);
}

export function getAzureOpenAIApiKey(env?: NodeJS.ProcessEnv) {
  return readSecret("AZURE_OPENAI_API_KEY", env);
}

export function getQualityIngestToken(env?: NodeJS.ProcessEnv) {
  return readSecret("QUALITY_INGEST_TOKEN", env);
}
