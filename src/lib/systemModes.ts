export type SystemModeName = 'pilot' | 'production' | 'sandbox' | 'preprod' | 'fire_drill' | 'demo';

export const SYSTEM_MODES: ReadonlyArray<SystemModeName> = [
  'pilot',
  'production',
  'sandbox',
  'preprod',
  'fire_drill',
  'demo',
] as const;

export const DEFAULT_SYSTEM_MODE: SystemModeName = 'fire_drill';

export function isSystemModeName(value: unknown): value is SystemModeName {
  return typeof value === 'string' && (SYSTEM_MODES as readonly string[]).includes(value);
}

export function loadTenantMode(tenant?: { mode?: string | null } | null): SystemModeName {
  if (tenant?.mode && isSystemModeName(tenant.mode)) {
    return tenant.mode;
  }

  return DEFAULT_SYSTEM_MODE;
}
