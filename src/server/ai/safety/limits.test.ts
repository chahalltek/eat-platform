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

  it('drops candidate summaries and trims oversized candidate lists', () => {
    const oversizedCandidates: SafeLLMContext = {
      candidates: Array.from({ length: MAX_CANDIDATES + 5 }, (_, idx) => ({
        name: `Candidate ${idx}`,
        summary: 's'.repeat(2_000),
        experience: 'e'.repeat(MAX_FIELD_CHARS),
      })),
    };

    const sanitized = enforceLimits(oversizedCandidates);

    expect((sanitized.candidates?.length ?? 0)).toBeLessThan(MAX_CANDIDATES);
    expect(sanitized.candidates?.every((candidate) => candidate.summary == null)).toBe(true);
    expect(JSON.stringify(sanitized).length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
  });

  it('returns untouched primitives when cloning and preserves candidates without summaries', () => {
    const context: SafeLLMContext = {
      metadata: { freeText: null, count: 5 },
      candidates: [{ name: 'No Summary' }],
    };

    const sanitized = enforceLimits(context);

    expect(sanitized.metadata?.count).toBe(5);
    expect(sanitized.candidates?.[0]).toEqual({ name: 'No Summary' });
  });

  it('keeps candidates without summaries when trimming large contexts', () => {
    const context: SafeLLMContext = {
      metadata: { freeText: 'x'.repeat(MAX_FIELD_CHARS * 5) },
      domainTags: Array.from({ length: 2000 }, (_, idx) => `d-${idx}`),
      candidates: [
        { name: 'Keep me' },
        { name: 'Truncate me', summary: 's'.repeat(MAX_FIELD_CHARS) },
      ],
    };

    const sanitized = enforceLimits(context);

    expect(sanitized.candidates?.some((candidate) => candidate.name === 'Keep me')).toBe(true);
  });

  it('removes top-level keys when the context is still too large after pruning', () => {
    const bloated: SafeLLMContext = {
      metadata: { freeText: 'x'.repeat(MAX_FIELD_CHARS + 10) },
      job: { description: 'y'.repeat(MAX_FIELD_CHARS + 10) },
      skillsPreferred: ['skill-1'],
      other: 'z'.repeat(MAX_FIELD_CHARS + 10),
      extra1: 'a'.repeat(MAX_FIELD_CHARS + 10),
      extra2: 'b'.repeat(MAX_FIELD_CHARS + 10),
      extra3: 'c'.repeat(MAX_FIELD_CHARS + 10),
      extra4: 'd'.repeat(MAX_FIELD_CHARS + 10),
      extra5: 'e'.repeat(MAX_FIELD_CHARS + 10),
      extra6: 'f'.repeat(MAX_FIELD_CHARS + 10),
      extra7: 'g'.repeat(MAX_FIELD_CHARS + 10),
      extra8: 'h'.repeat(MAX_FIELD_CHARS + 10),
      extra9: 'i'.repeat(MAX_FIELD_CHARS + 10),
      extra10: 'j'.repeat(MAX_FIELD_CHARS + 10),
      extra11: 'k'.repeat(MAX_FIELD_CHARS + 10),
      extra12: 'l'.repeat(MAX_FIELD_CHARS + 10),
    };

    const sanitized = enforceLimits(bloated);

    expect(sanitized.job).toBeUndefined();
    expect(Object.keys(sanitized).length).toBeLessThan(Object.keys(bloated).length);
    expect(JSON.stringify(sanitized).length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
  });
});
