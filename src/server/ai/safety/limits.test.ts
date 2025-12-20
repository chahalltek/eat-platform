import { describe, expect, it } from 'vitest';

import {
  enforceLimits,
  MAX_CANDIDATES,
  MAX_CONTEXT_CHARS,
  MAX_FIELD_CHARS,
  type SafeLLMContext,
} from './limits';

describe('enforceLimits', () => {
  it('truncates long job descriptions', () => {
    const description = 'd'.repeat(MAX_FIELD_CHARS + 500);
    const context: SafeLLMContext = {
      job: { description },
    };

    const sanitized = enforceLimits(context);

    expect(sanitized.job?.description?.length).toBe(MAX_FIELD_CHARS);
    expect(context.job?.description).toBe(description);
  });

  it('caps the number of candidates', () => {
    const context: SafeLLMContext = {
      candidates: Array.from({ length: MAX_CANDIDATES + 10 }, (_, idx) => ({
        name: `Candidate ${idx}`,
      })),
    };

    const sanitized = enforceLimits(context);

    expect(sanitized.candidates?.length).toBe(MAX_CANDIDATES);
    expect(context.candidates?.length).toBe(MAX_CANDIDATES + 10);
  });

  it('drops low-priority fields in order when total size exceeds the cap', () => {
    const verboseContext: SafeLLMContext = {
      metadata: { freeText: 'x'.repeat(MAX_FIELD_CHARS + 123) },
      domainTags: Array.from({ length: 800 }, (_, idx) => `domain-${idx}`),
      skillsPreferred: Array.from({ length: 800 }, (_, idx) => `skill-${idx}`),
      job: { title: 'Principal Engineer', description: 'role-details.'.repeat(1500) },
      candidates: Array.from({ length: 8 }, (_, idx) => ({
        name: `Candidate ${idx}`,
        summary: 's'.repeat(MAX_FIELD_CHARS),
        certifications: Array.from({ length: 400 }, (_, certIdx) => `cert-${certIdx}`),
        skills: Array.from({ length: 50 }, (_, skillIdx) => `skill-${skillIdx}`),
      })),
    };

    const sanitized = enforceLimits(verboseContext);

    expect(sanitized.metadata?.freeText).toBeUndefined();
    expect(sanitized.domainTags).toBeUndefined();
    expect(sanitized.skillsPreferred).toBeUndefined();
    expect(sanitized.candidates?.every((candidate) => !candidate.certifications?.length)).toBe(true);
    expect(JSON.stringify(sanitized).length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);

    // Ensure original is untouched.
    expect(verboseContext.metadata?.freeText).toBeDefined();
    expect(verboseContext.domainTags?.length).toBe(800);
  });
});
