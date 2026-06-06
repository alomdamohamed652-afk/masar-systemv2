-- ============================================================
-- MIGRATION 008 — Default Founder Account Setup
-- Creates a trigger that auto-promotes the first user to founder
-- ============================================================

-- Function: if this is the first user ever, make them founder
CREATE OR REPLACE FUNCTION auto_promote_first_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;
  -- If this is the very first profile row, make them founder
  IF user_count = 1 THEN
    UPDATE profiles SET role = 'founder' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS promote_first_user ON profiles;
CREATE TRIGGER promote_first_user
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_promote_first_user();

-- ============================================================
-- SEED: Default founder credentials
-- Email:    admin@masar.com
-- Password: Admin@Masar2025
-- ============================================================
-- NOTE: This only stores the profile row.
-- The actual auth user must be created via Supabase Dashboard
-- or via the API using these credentials.
-- After running this migration, create the auth user with:
--   Email: admin@masar.com
--   Password: Admin@Masar2025
-- Then run:
--   UPDATE profiles SET role = 'founder', name = 'MASAR Admin' 
--   WHERE email = 'admin@masar.com';
