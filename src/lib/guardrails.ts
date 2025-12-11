import { DEFAULT_SYSTEM_MODE, isSystemModeName, type SystemModeName } from './systemModes';

export type GuardrailPreset = 'conservative' | 'standard';

export const DEFAULT_GUARDRAIL_MODE: SystemModeName = 'fire_drill';
export const DEFAULT_GUARDRAIL_PRESET: GuardrailPreset = 'conservative';

type GuardrailOptions = {
  systemMode?: string | null;
  tenantOverride?: GuardrailPreset | null;
  tenantOptOut?: boolean;
};

export function resolveGuardrailPreset({
  systemMode,
  tenantOverride,
  tenantOptOut = false,
}: GuardrailOptions): GuardrailPreset {
  const normalizedSystemMode: SystemModeName = isSystemModeName(systemMode)
    ? systemMode
    : DEFAULT_SYSTEM_MODE;

  if (normalizedSystemMode === 'fire_drill' && !tenantOptOut) {
    return DEFAULT_GUARDRAIL_PRESET;
  }

  return tenantOverride ?? DEFAULT_GUARDRAIL_PRESET;
}
