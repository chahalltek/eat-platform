/// <reference types="vitest/globals" />

import {
  assertValidRinaResponse,
  RINA_PROMPT_VERSION,
  RINA_SYSTEM_PROMPT,
} from '@/lib/agents/contracts/rinaContract';
import {
  assertValidRuaResponse,
  RUA_PROMPT_VERSION,
  RUA_SYSTEM_PROMPT,
} from '@/lib/agents/contracts/ruaContract';

describe('LLM contract schemas', () => {
  it('accepts a valid RINA payload', () => {
    const payload = {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: null,
      location: 'Remote',
      currentTitle: 'Frontend Engineer',
      currentCompany: 'Acme',
      totalExperienceYears: 5,
      seniorityLevel: 'mid',
      summary: 'Experienced engineer',
      skills: [
        {
          name: 'React',
          normalizedName: 'React',
          proficiency: 'advanced',
          yearsOfExperience: 4,
        },
      ],
      parsingConfidence: 0.9,
      warnings: [],
    } satisfies Parameters<typeof assertValidRinaResponse>[0];

    expect(assertValidRinaResponse(payload)).toEqual(payload);
  });

  it('rejects malformed RINA payloads', () => {
    const badPayload = {
      fullName: '',
      skills: [],
      parsingConfidence: 2,
      warnings: [],
    };

    expect(() => assertValidRinaResponse(badPayload)).toThrowError(/RINA response failed schema validation/);
  });

  it('accepts a valid RUA payload', () => {
    const payload = {
      clientName: 'Globex',
      title: 'Senior Backend Engineer',
      seniorityLevel: 'senior',
      location: 'Remote',
      remoteType: 'fully-remote',
      employmentType: 'full-time',
      responsibilitiesSummary: 'Build services',
      teamContext: 'Platform team',
      priority: 'high',
      status: 'open',
      ambiguityScore: 0.2,
      skills: [
        { name: 'Node.js', normalizedName: 'Node.js', isMustHave: true },
        { name: 'PostgreSQL', normalizedName: 'PostgreSQL', isMustHave: false },
      ],
    } satisfies Parameters<typeof assertValidRuaResponse>[0];

    expect(assertValidRuaResponse(payload)).toEqual(payload);
  });

  it('rejects malformed RUA payloads', () => {
    const badPayload = {
      title: 'Data Scientist',
      seniorityLevel: null,
      location: null,
      remoteType: null,
      employmentType: null,
      responsibilitiesSummary: null,
      teamContext: null,
      priority: null,
      status: null,
      ambiguityScore: null,
      skills: [
        { name: 'Python', normalizedName: 'Python', isMustHave: true },
        { name: '', normalizedName: '', isMustHave: 'yes' },
      ],
    } as unknown;

    expect(() => assertValidRuaResponse(badPayload)).toThrowError(/RUA response failed schema validation/);
  });

  it('snapshots versioned prompts', () => {
    expect({ version: RINA_PROMPT_VERSION, prompt: RINA_SYSTEM_PROMPT }).toMatchSnapshot('RINA prompt contract');
    expect({ version: RUA_PROMPT_VERSION, prompt: RUA_SYSTEM_PROMPT }).toMatchSnapshot('RUA prompt contract');
  });
});
