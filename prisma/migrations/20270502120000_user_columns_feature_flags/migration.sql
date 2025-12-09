-- Legacy migration for user tenant/displayName + feature flags.
-- This has been superseded by later migrations (20270523100000_user_tenant_column_patch, etc.).
-- To avoid conflicting schema operations in production, this migration is now a no-op.

DO $$
BEGIN
  -- intentionally left blank
END;
$$;
