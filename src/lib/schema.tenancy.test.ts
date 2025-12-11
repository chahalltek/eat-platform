import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

const CORE_MODELS = [
  'User',
  'FeatureFlag',
  'AgentFlag',
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
  'TenantSubscription',
];

const UNIQUE_WITH_TENANT = {
  User: '@@unique([tenantId, email])',
  FeatureFlag: '@@unique([tenantId, name])',
  AgentFlag: '@@unique([tenantId, agentName])',
};

function readModelBlock(schema: string, model: string) {
  const match = schema.match(new RegExp(`model\\s+${model}\\s+\\{([\\s\\S]*?)\\}`, 'm'));
  return match?.[1] ?? '';
}

describe('schema tenancy', () => {
  const schema = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');

  it('adds tenantId and indexes to all core models', () => {
    CORE_MODELS.forEach((model) => {
      const block = readModelBlock(schema, model);
      const indexLines = block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('@@index'));

      expect(block).toContain('tenantId');
      expect(indexLines.some((line) => line.includes('tenantId'))).toBe(true);
    });
  });

  it('enforces tenant scoping on unique constraints for tenant-bound models', () => {
    Object.entries(UNIQUE_WITH_TENANT).forEach(([model, uniqueConstraint]) => {
      const block = readModelBlock(schema, model);
      expect(block).toContain(uniqueConstraint);
    });
  });

  it('includes configuration fields for tenant modes and presets', () => {
    const tenantConfigBlock = readModelBlock(schema, 'TenantConfig');
    const tenantModeBlock = readModelBlock(schema, 'TenantMode');
    const systemModeBlock = readModelBlock(schema, 'SystemMode');

    expect(tenantConfigBlock).toContain('tenantId');
    expect(tenantConfigBlock).toContain('preset');
    expect(tenantConfigBlock).toContain('scoring');
    expect(tenantConfigBlock).toContain('explain');
    expect(tenantConfigBlock).toContain('safety');
    expect(tenantConfigBlock).toContain('@unique');

    expect(tenantModeBlock).toContain('tenantId');
    expect(tenantModeBlock).toContain('mode');
    expect(tenantModeBlock).toContain('@unique');

    expect(systemModeBlock).toContain('tenantId');
    expect(systemModeBlock).toContain('mode');
    expect(systemModeBlock).toContain('@unique');
  });
});
