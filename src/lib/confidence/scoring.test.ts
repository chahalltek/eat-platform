import { describe, expect, it } from 'vitest';
import { computeConfidenceScore } from './scoring';

describe('computeConfidenceScore', () => {
  const baseDate = new Date();

  it('gives low confidence for empty candidate profile', () => {
    const result = computeConfidenceScore({
      jobSkills: ['python', 'sql'],
      candidateSkills: [],
      hasTitle: false,
      hasLocation: false,
      createdAt: new Date(baseDate.getTime() - 200 * 24 * 60 * 60 * 1000), // ~200 days ago
    });

    expect(result.total).toBeLessThan(30);
  });

  it('gives higher confidence for complete, recent, overlapped profile', () => {
    const result = computeConfidenceScore({
      jobSkills: ['python', 'sql', 'snowflake', 'airflow'],
      candidateSkills: ['python', 'sql', 'snowflake', 'airflow', 'dbt'],
      hasTitle: true,
      hasLocation: true,
      createdAt: baseDate, // now
    });

    expect(result.total).toBeGreaterThan(70);
    expect(result.total).toBeLessThanOrEqual(100);
  });
});
