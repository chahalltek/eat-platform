import { describe, expect, it } from 'vitest'

import { redactAny, redactPII, redactSecrets } from './redact'

describe('redactPII', () => {
  it('redacts email addresses', () => {
    expect(
      redactPII('Contact me at example.user+dev@test-company.com for info.')
    ).toContain('[REDACTED_EMAIL]')
  })

  it('redacts US phone numbers', () => {
    expect(redactPII('Call 415-555-1234 or (415) 555-9876')).toBe(
      'Call [REDACTED_PHONE] or [REDACTED_PHONE]'
    )
  })

  it('redacts SSN-like patterns', () => {
    expect(redactPII('SSN 123-45-6789')).toBe('SSN [REDACTED_SSN]')
  })
})

describe('redactSecrets', () => {
  it('redacts JWT-like tokens', () => {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.ZXlKMUlqb2lRWEJ3YkdGbklpd2lZWFZr'
    expect(redactSecrets(`Bearer ${token}`)).toBe(
      'Bearer [REDACTED_TOKEN]'
    )
  })

  it('redacts long opaque tokens', () => {
    expect(
      redactSecrets(
        'token=6c5e7f0b4d2f8c9a7b6c5e4d3f2b1a0c9d8e7f6c5b4a3d2f1e0c9b8a7d6f5c'
      )
    ).toBe('token=[REDACTED_TOKEN]')
  })

  it('redacts apiKey parameters', () => {
    expect(
      redactSecrets('https://example.com?apiKey=abcd1234&other=yes')
    ).toBe('[REDACTED_URL]')
  })

  it('redacts Authorization bearer values', () => {
    expect(
      redactSecrets('Authorization: Bearer secret-value-1234567890')
    ).toBe('Authorization: Bearer [REDACTED_SECRET]')
  })

  it('redacts standalone opaque tokens', () => {
    expect(redactSecrets('this-is-a-very-long-secret-token-value-1234567890')).toBe(
      '[REDACTED_TOKEN]'
    )
  })

  it('redacts URLs when enabled', () => {
    expect(
      redactSecrets(
        'See https://example.com/path?query=value and http://another.test'
      )
    ).toBe('See [REDACTED_URL] and [REDACTED_URL]')
  })

  it('can skip URL redaction when configured', () => {
    const text = 'Visit https://safe.example.com'
    expect(redactSecrets(text, { redactUrls: false })).toBe(text)
  })
})

describe('redactAny', () => {
  it('redacts strings inside nested objects and arrays', () => {
    const input = {
      user: {
        email: 'test@example.com',
        phone: '+1 415 555 1234',
        profile: ['Call me at 415-555-9876', 42],
      },
      token:
        'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MjAwMDAwMDB9.Zm9vYmFyYmF6cXV4eHl6MTIzNA',
    }

    const result = redactAny(input) as Record<string, unknown>

    expect(result.user).toEqual({
      email: '[REDACTED_EMAIL]',
      phone: '[REDACTED_PHONE]',
      profile: ['Call me at [REDACTED_PHONE]', 42],
    })
    expect(result.token).toBe('[REDACTED_TOKEN]')
  })

  it('leaves non-string primitives unchanged', () => {
    expect(redactAny({ count: 3, valid: true, when: null })).toEqual({
      count: 3,
      valid: true,
      when: null,
    })
  })

  it('keeps Dates and regex values intact while redacting siblings', () => {
    const date = new Date()
    const regex = /test/

    const result = redactAny({ at: date, pattern: regex, token: 'a'.repeat(40) }) as Record<string, unknown>

    expect(result.at).toBe(date)
    expect(result.pattern).toBe(regex)
    expect(result.token).toBe('[REDACTED_TOKEN]')
  })
})
