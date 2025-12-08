import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

const CORE_MODELS = [
  'User',
  'FeatureFlag',
  'Candidate',
  'CandidateSkill',
  'Customer',
  'JobReq',
  'JobSkill',
  'Match',
  'MatchResult',
  'AgentRunLog',
  'OutreachInteraction',
  'JobCandidate',
];

function readModelBlock(schema: string, model: string) {
  const match = schema.match(new RegExp(`model\\s+${model}\\s+\\{([\\s\\S]*?)\\}`, 'm'));
  return match?.[1] ?? '';
}

describe('schema tenancy', () => {
  const schema = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');

  it('adds tenantId to all core models', () => {
    CORE_MODELS.forEach((model) => {
      const block = readModelBlock(schema, model);
      expect(block).toContain('tenantId');
      expect(block).toMatch(/@@index\(\[tenantId\]/);
    });
  });

  it('enforces tenant scoping on shared unique constraints', () => {
    const jobCandidateBlock = readModelBlock(schema, 'JobCandidate');
    const featureFlagBlock = readModelBlock(schema, 'FeatureFlag');

    expect(jobCandidateBlock).toContain('@@unique([tenantId, jobReqId, candidateId])');
    expect(featureFlagBlock).toContain('@@unique([tenantId, name])');
  });
});
