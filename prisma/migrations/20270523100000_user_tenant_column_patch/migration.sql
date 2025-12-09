-- Legacy patch migration for User tenant/displayName columns.
-- This logic is now handled by earlier migrations (user_tenant_displayname, user_columns_*).
-- To avoid conflicting schema operations in production, this migration is intentionally a no-op.

DO $$
BEGIN
  -- no-op
END;
$$;
