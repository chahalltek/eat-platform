-- Backfill default guardrail preset and llm config for existing tenants
UPDATE "TenantConfig"
SET "preset" = 'balanced'
WHERE "preset" IS NULL;

UPDATE "TenantConfig"
SET "llm" = '{"provider":"openai","model":"gpt-4.1-mini","allowedAgents":["EXPLAIN","RINA","RUA","OUTREACH","INTAKE"],"maxTokens":600,"verbosityCap":2000}'::jsonb
WHERE "llm" IS NULL;
