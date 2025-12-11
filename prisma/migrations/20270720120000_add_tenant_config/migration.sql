-- Create TenantConfig table to hold tenant-level guardrail settings
CREATE TABLE "TenantConfig" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "scoring" JSONB NOT NULL,
  "explain" JSONB NOT NULL,
  "safety" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantConfig_pkey" PRIMARY KEY ("id")
);

-- Enforce unique config per tenant
CREATE UNIQUE INDEX "TenantConfig_tenantId_key" ON "TenantConfig"("tenantId");

-- Wire config to tenants
ALTER TABLE "TenantConfig"
  ADD CONSTRAINT "TenantConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default config for the default tenant if missing
INSERT INTO "TenantConfig" ("id", "tenantId", "scoring", "explain", "safety", "createdAt", "updatedAt")
SELECT
  'default-tenant-config',
  'default-tenant',
  '{
    "strategy": "weighted",
    "weights": {
      "mustHaveSkills": 0.4,
      "niceToHaveSkills": 0.2,
      "experience": 0.25,
      "location": 0.15
    },
    "thresholds": {
      "minMatchScore": 0.55,
      "shortlistMinScore": 0.65,
      "shortlistMaxCandidates": 5
    }
  }'::jsonb,
  '{
    "level": "compact",
    "includeWeights": false
  }'::jsonb,
  '{
    "requireMustHaves": true,
    "excludeInternalCandidates": false
  }'::jsonb,
  NOW(),
  NOW()
WHERE EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id" = 'default-tenant')
  AND NOT EXISTS (SELECT 1 FROM "TenantConfig" tc WHERE tc."tenantId" = 'default-tenant');
