-- ============================================================
-- MIGRATION 002 — Products & Inventory
-- categories, warehouses, products, product_images,
-- product_variants, warehouse_stocks, inventory_movements
-- ============================================================

-- 1. Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Products (no images column — use product_images table)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  barcode TEXT,
  internal_code TEXT,
  supplier TEXT,
  brand TEXT,
  description TEXT,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sell_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Product images (replaces TEXT[] — supports ordering, primary flag)
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Product variants (stable UUIDs — never delete-reinsert)
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color TEXT,
  size TEXT,
  sku_variant TEXT,
  UNIQUE(product_id, color, size)
);

-- 6. Warehouse stocks — snapshot updated transactionally with every movement
CREATE TABLE IF NOT EXISTS warehouse_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  quantity INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(warehouse_id, variant_id)
);

-- 7. Inventory movements — source of truth
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('add','remove','adjustment','damaged','customer_return','warehouse_transfer')),
  quantity INT NOT NULL,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TRIGGER: Every movement atomically updates warehouse_stocks
-- Both succeed or both fail — no partial state possible
-- ============================================================
CREATE OR REPLACE FUNCTION sync_warehouse_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO warehouse_stocks (warehouse_id, product_id, variant_id, quantity, updated_at)
  VALUES (NEW.warehouse_id, NEW.product_id, NEW.variant_id, NEW.quantity, now())
  ON CONFLICT (warehouse_id, variant_id)
  DO UPDATE SET
    quantity   = warehouse_stocks.quantity + EXCLUDED.quantity,
    updated_at = now();

  -- Prevent stock going below zero (safety guard)
  UPDATE warehouse_stocks
  SET quantity = 0
  WHERE warehouse_id = NEW.warehouse_id
    AND variant_id   = NEW.variant_id
    AND quantity     < 0;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_movement_insert ON inventory_movements;
CREATE TRIGGER after_movement_insert
  AFTER INSERT ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION sync_warehouse_stock();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stocks_warehouse ON warehouse_stocks(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stocks_product ON warehouse_stocks(product_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stocks_variant ON warehouse_stocks(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse ON inventory_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at);

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read; write controlled by server-side role check
CREATE POLICY "categories_select" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_all_privileged" ON categories FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('founder','manager','warehouse'))
);

CREATE POLICY "warehouses_select" ON warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "warehouses_write_founder" ON warehouses FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'founder')
);

CREATE POLICY "products_select" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_write" ON products FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('founder','manager'))
);

CREATE POLICY "product_images_select" ON product_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "product_images_write" ON product_images FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('founder','manager'))
);

CREATE POLICY "product_variants_select" ON product_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "product_variants_write" ON product_variants FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('founder','manager'))
);

CREATE POLICY "warehouse_stocks_select" ON warehouse_stocks FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventory_movements_select" ON inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_movements_insert" ON inventory_movements FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('founder','manager','warehouse'))
);
