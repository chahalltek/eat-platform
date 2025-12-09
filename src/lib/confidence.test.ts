import { describe, expect, it } from 'vitest';

import { computeConfidence } from './confidence';
import type { CandidateProfile } from './contracts/candidateProfile';
import type { JobIntakeProfile } from './contracts/jobIntake';
import type { MatchScoreBreakdown } from './matching/scoring';

describe('computeConfidence', () => {
  const baseJob: JobIntakeProfile = {
    tenantId: 'tenant-1',
    jobReqId: 'req-1',
    title: 'Data Engineer',
    normalizedTitle: 'data engineer',
    location: 'Remote',
    employmentType: 'full-time',
    seniorityLevel: 'mid',
    skills: [
      { name: 'Python', normalizedName: 'python', required: true, weight: null },
      { name: 'SQL', normalizedName: 'sql', required: true, weight: null },
      { name: 'Airflow', normalizedName: 'airflow', required: false, weight: null },
    ],
    mustHaves: [],
    niceToHaves: [],
    ambiguities: [],
  };

  const lowQualityCandidate: CandidateProfile = {
    tenantId: 'tenant-1',
    candidateId: 'cand-low',
    fullName: '',
    email: null,
    phone: null,
    location: null,
    currentTitle: null,
    currentCompany: null,
    totalExperienceYears: null,
    seniorityLevel: null,
    normalizedSkills: [],
    summary: null,
    trustScore: null,
    parsingConfidence: null,
  };

  const strongCandidate: CandidateProfile = {
    tenantId: 'tenant-1',
    candidateId: 'cand-strong',
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+15555555555',
    location: 'Remote',
    currentTitle: 'Data Engineer',
    currentCompany: 'Tech Co',
    totalExperienceYears: 5,
    seniorityLevel: 'Mid',
    normalizedSkills: [
      { name: 'Python', normalizedName: 'python', proficiency: 'expert', yearsOfExperience: 5 },
      { name: 'SQL', normalizedName: 'sql', proficiency: 'advanced', yearsOfExperience: 5 },
      { name: 'Airflow', normalizedName: 'airflow', proficiency: 'advanced', yearsOfExperience: 3 },
    ],
    summary: 'Experienced data engineer.',
    trustScore: 90,
    parsingConfidence: 0.9,
  };

  it('produces a low confidence score for incomplete candidates', () => {
    const match: MatchScoreBreakdown = {
      skillOverlapScore: 10,
      titleSimilarityScore: 0,
      compositeScore: 7,
    };

    const result = computeConfidence(match, baseJob, lowQualityCandidate);

    expect(result.confidenceScore).toBeLessThan(40);
    expect(result.reasons.join(' ')).toContain('missing');
  });

  it('produces a high confidence score when data is complete and skills align', () => {
    const match: MatchScoreBreakdown = {
      skillOverlapScore: 90,
      titleSimilarityScore: 80,
      compositeScore: 86,
    };

    const result = computeConfidence(match, baseJob, strongCandidate);

    expect(result.confidenceScore).toBeGreaterThan(80);
    expect(result.confidenceScore).toBeLessThanOrEqual(100);
    expect(result.reasons).toContain('Candidate seniority matches job requirement.');
  });
});
