-- ============================================================
-- MIGRATION 001 — Core System Tables
-- settings, role_permissions, profiles
-- ============================================================

-- 1. Settings (single row, inserted below)
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name TEXT NOT NULL DEFAULT 'MASAR',
  logo_light_url TEXT,
  logo_dark_url TEXT,
  currency TEXT NOT NULL DEFAULT 'EGP',
  tax_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 10,
  phone TEXT,
  email TEXT,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'Africa/Cairo',
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO settings (brand_name, currency, timezone)
VALUES ('MASAR', 'EGP', 'Africa/Cairo')
ON CONFLICT DO NOTHING;

-- 2. Role permissions (flat boolean table — one row per role)
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT UNIQUE NOT NULL,
  orders BOOLEAN NOT NULL DEFAULT false,
  products BOOLEAN NOT NULL DEFAULT false,
  inventory BOOLEAN NOT NULL DEFAULT false,
  customers BOOLEAN NOT NULL DEFAULT false,
  expenses BOOLEAN NOT NULL DEFAULT false,
  reports BOOLEAN NOT NULL DEFAULT false,
  hr BOOLEAN NOT NULL DEFAULT false,
  settings BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO role_permissions (role, orders, products, inventory, customers, expenses, reports, hr, settings) VALUES
  ('founder',          true,  true,  true,  true,  true,  true,  true,  true),
  ('manager',          true,  true,  true,  true,  true,  true,  true,  false),
  ('accountant',       true,  false, false, true,  true,  true,  false, false),
  ('customer_service', true,  false, false, true,  false, false, false, false),
  ('warehouse',        false, false, true,  false, false, false, false, false),
  ('employee',         false, false, false, false, false, false, false, false)
ON CONFLICT (role) DO NOTHING;

-- 3. Profiles (linked to auth.users — Supabase manages auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'employee',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile row when a new auth user is created
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    'employee'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();

-- RLS: users can read their own profile; founders/managers can read all
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_select_all_privileged" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('founder', 'manager')
    )
  );

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_update_privileged" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('founder', 'manager')
    )
  );

-- Settings: readable by all authenticated, writable by founder only
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select" ON settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "settings_update_founder" ON settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'founder'
    )
  );

-- role_permissions: readable by all authenticated
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_select" ON role_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "role_permissions_update_founder" ON role_permissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'founder'
    )
  );
