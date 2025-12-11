import { describe, expect, it } from 'vitest';

import { AGENT_KILL_SWITCHES } from '@/lib/agents/killSwitch';
import {
  loadAgentKillSwitchesFromEnv,
  loadGuardrailsPreset,
  loadTenantConfig,
  loadTenantName,
  resolveGuardrailsInput,
  type TenantGuardrailsConfig,
} from './index';

describe('guardrails loader', () => {
  const tenant = { id: 'tenant-123', name: 'Acme Pilot' };

  it('derives tenant name with a fallback to id', () => {
    expect(loadTenantName(tenant)).toBe('Acme Pilot');
    expect(loadTenantName({ id: 'tenant-123', name: '' })).toBe('tenant-123');
  });

  it('uses guardrail preset when tenant config is missing', () => {
    const result = loadTenantConfig(tenant, null);

    expect(result.mode).toBe('Acme Pilot');
    expect(result.guardrails).toEqual(loadGuardrailsPreset('Acme Pilot'));
  });

  it('prefers tenant guardrails when marked as set', () => {
    const guardrails = { preset: 'custom', isSet: true, policy: 'strict' } satisfies TenantGuardrailsConfig['guardrails'];
    const result = loadTenantConfig(tenant, { guardrails });

    expect(result.guardrails).toMatchObject({ preset: 'custom', isSet: true, policy: 'strict' });
  });

  it('falls back to tenant name for mode and allows overrides', () => {
    const result = loadTenantConfig({ id: 't-1', name: '' }, { guardrails: null, mode: 'production' });

    expect(result.mode).toBe('production');
    expect(result.guardrails.preset).toBe('production');
  });

  it('merges environment and tenant agent kill switches', () => {
    const env = {
      AGENT_KILL_SWITCH_EAT_TS_RINA: 'true',
      AGENT_KILL_SWITCH_EAT_TS_OUTREACH: 'false',
    } as NodeJS.ProcessEnv;

    const tenantKillSwitches = {
      [AGENT_KILL_SWITCHES.OUTREACH]: true,
    } satisfies TenantGuardrailsConfig['agentKillSwitches'];

    const result = loadTenantConfig(tenant, { guardrails: null, agentKillSwitches: tenantKillSwitches }, env);

    expect(result.agentKillSwitches[AGENT_KILL_SWITCHES.RINA]).toBe(true);
    expect(result.agentKillSwitches[AGENT_KILL_SWITCHES.OUTREACH]).toBe(true);
    expect(result.agentKillSwitches[AGENT_KILL_SWITCHES.RANKER]).toBe(false);
  });

  it('ensures guardrail resolution uses tenant mode when missing', () => {
    const config = loadTenantConfig(tenant, { guardrails: null });
    const resolved = resolveGuardrailsInput({}, config);

    expect(resolved.mode).toBe(config.mode);
    expect(resolveGuardrailsInput({ mode: 'sandbox' }, config).mode).toBe('sandbox');
  });
});

describe('environment kill switch parsing', () => {
  it('parses booleans from env with sanitization', () => {
    const env = {
      AGENT_KILL_SWITCH_EAT_TS_RUA: 'TrUe',
      AGENT_KILL_SWITCH_EAT_TS_RANKER: '0',
      AGENT_KILL_SWITCH_EAT_TS_INTAKE: 'yes',
    } as NodeJS.ProcessEnv;

    const parsed = loadAgentKillSwitchesFromEnv(env);

    expect(parsed[AGENT_KILL_SWITCHES.RUA]).toBe(true);
    expect(parsed[AGENT_KILL_SWITCHES.RANKER]).toBe(false);
    expect(parsed[AGENT_KILL_SWITCHES.INTAKE]).toBe(true);
  });
});
