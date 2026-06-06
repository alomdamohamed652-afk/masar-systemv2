-- ============================================================
-- MIGRATION 009 — Default Admin Setup Instructions
-- ============================================================
-- After running this migration, create the founder account:
--
-- STEP 1: Go to Supabase Dashboard → Authentication → Users
--         Click "Add user" → "Create new user"
--         Email:    admin@masar.com
--         Password: Admin@Masar2025
--         ✅ Auto Confirm User
--
-- STEP 2: Run this SQL to promote them to founder:

-- Auto-promote trigger: first user ever becomes founder
CREATE OR REPLACE FUNCTION auto_promote_first_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM profiles;
  IF v_count = 1 THEN
    NEW.role := 'founder';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_first_user ON profiles;
CREATE TRIGGER trg_promote_first_user
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_promote_first_user();

-- ============================================================
-- Run after creating the auth user:
-- UPDATE profiles SET role='founder', name='MASAR Admin'
-- WHERE email='admin@masar.com';
-- ============================================================
