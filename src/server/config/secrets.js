const PROD_SECRET_PATTERN = /_PROD_/i;

function toBoolean(value, defaultValue = false) {
  if (value === undefined) return defaultValue;

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function enforcePreviewProdSecretGuard(env = process.env) {
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

function readSecret(name, env = process.env) {
  return env[name];
}

export function getAuthSessionSecret(env) {
  return readSecret("AUTH_SESSION_SECRET", env);
}

export function getLocalAuthSessionSecret(env) {
  return readSecret("AUTH_SESSION_SECRET_LOCAL", env);
}

export function getBullhornWebhookSecret(env) {
  return readSecret("BULLHORN_WEBHOOK_SECRET", env);
}

export function getOpenAIApiKey(env) {
  return readSecret("OPENAI_API_KEY", env);
}

export function getAzureOpenAIApiKey(env) {
  return readSecret("AZURE_OPENAI_API_KEY", env);
}

export function getQualityIngestToken(env) {
  return readSecret("QUALITY_INGEST_TOKEN", env);
}
