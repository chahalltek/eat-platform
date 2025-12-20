type RedactOptions = {
  redactUrls?: boolean
}

const defaultOptions: Required<RedactOptions> = {
  redactUrls: true,
}

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const US_PHONE_REGEX =
  /(?:\+?1[-.\s]*)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/g
const GENERIC_PHONE_REGEX = /\+?\d{1,3}[-.\s]?\d{3}[-.\s]?\d{4,6}\b/g
const SSN_REGEX = /\b\d{3}-?\d{2}-?\d{4}\b/g
const JWT_REGEX =
  /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g
const KEY_VALUE_SECRET_REGEX = /(\b[\w-]{1,30}=)([A-Za-z0-9=_\-/]{16,})/g
const LONG_TOKEN_REGEX = /(?<=[:=\s]|^)[A-Za-z0-9=_\-/]{32,}\b/g
const API_KEY_REGEX = /(api[-_]?key\s*=\s*)([A-Za-z0-9-._~+/]+=*)/gi
const BEARER_REGEX = /(Authorization:\s*Bearer\s+)([A-Za-z0-9-._~+/]+=*)/gi
const URL_REGEX = /\bhttps?:\/\/[^\s]+/gi

const redactValue = (value: string, replacement: string) => replacement

export function redactPII(text: string): string {
  return text
    .replace(EMAIL_REGEX, match => redactValue(match, '[REDACTED_EMAIL]'))
    .replace(US_PHONE_REGEX, match => redactValue(match, '[REDACTED_PHONE]'))
    .replace(
      GENERIC_PHONE_REGEX,
      match => redactValue(match, '[REDACTED_PHONE]')
    )
    .replace(SSN_REGEX, match => redactValue(match, '[REDACTED_SSN]'))
}

export function redactSecrets(
  text: string,
  options: RedactOptions = defaultOptions
): string {
  const mergedOptions = { ...defaultOptions, ...options }

  let redacted = text
    .replace(JWT_REGEX, match => redactValue(match, '[REDACTED_TOKEN]'))
    .replace(
      KEY_VALUE_SECRET_REGEX,
      (_match, prefix) => `${prefix}[REDACTED_TOKEN]`
    )
    .replace(LONG_TOKEN_REGEX, match => redactValue(match, '[REDACTED_TOKEN]'))
    .replace(API_KEY_REGEX, (_match, prefix) => `${prefix}[REDACTED_SECRET]`)
    .replace(BEARER_REGEX, (_match, prefix) => `${prefix}[REDACTED_SECRET]`)

  if (mergedOptions.redactUrls) {
    redacted = redacted.replace(URL_REGEX, () => '[REDACTED_URL]')
  }

  return redacted
}

export function redactAny(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactSecrets(redactPII(value))
  }

  if (Array.isArray(value)) {
    return value.map(item => redactAny(item))
  }

  if (value && typeof value === 'object') {
    if (value instanceof Date || value instanceof RegExp) {
      return value
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        redactAny(entry),
      ])
    )
  }

  return value
}
