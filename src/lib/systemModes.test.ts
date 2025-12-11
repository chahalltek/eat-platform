import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SYSTEM_MODE,
  SYSTEM_MODES,
  isSystemModeName,
  loadTenantMode,
  type SystemModeName,
} from './systemModes';
import { DEFAULT_GUARDRAIL_MODE, DEFAULT_GUARDRAIL_PRESET, resolveGuardrailPreset } from './guardrails';

describe('systemModes', () => {
  it('includes the fire_drill mode', () => {
    expect(SYSTEM_MODES).toContain('fire_drill');
  });

  it('treats fire_drill as a valid system mode', () => {
    expect(isSystemModeName('fire_drill')).toBe(true);
  });

  it('normalizes tenant mode to fire_drill by default', () => {
    expect(loadTenantMode()).toBe('fire_drill');
    expect(loadTenantMode({ mode: null })).toBe('fire_drill');
    expect(loadTenantMode({ mode: 'not-a-mode' })).toBe('fire_drill');
  });

  it('returns the tenant fire_drill mode when explicitly set', () => {
    expect(loadTenantMode({ mode: 'fire_drill' })).toBe('fire_drill');
  });

  it('round-trips other known modes safely', () => {
    const knownModes = SYSTEM_MODES.filter((mode) => mode !== 'fire_drill');

    for (const mode of knownModes) {
      expect(loadTenantMode({ mode })).toBe(mode);
    }
  });
});

describe('guardrails', () => {
  it('defaults guardrails to fire_drill and conservative presets', () => {
    expect(DEFAULT_SYSTEM_MODE).toBe('fire_drill');
    expect(DEFAULT_GUARDRAIL_MODE).toBe('fire_drill');
    expect(DEFAULT_GUARDRAIL_PRESET).toBe('conservative');
  });

  it('enforces conservative guardrails when system mode is fire_drill', () => {
    expect(
      resolveGuardrailPreset({
        systemMode: 'fire_drill',
        tenantOverride: 'standard',
        tenantOptOut: false,
      }),
    ).toBe('conservative');
  });

  it('lets tenants opt out of stricter guardrails', () => {
    const relaxedMode = resolveGuardrailPreset({
      systemMode: 'fire_drill',
      tenantOverride: 'standard',
      tenantOptOut: true,
    });

    expect(relaxedMode).toBe('standard');
  });

  it('falls back to conservative defaults when overrides are missing', () => {
    const preset = resolveGuardrailPreset({ systemMode: 'sandbox', tenantOverride: null });

    expect(preset).toBe('conservative');
  });
});
