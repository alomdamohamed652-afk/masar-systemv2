-- Add shipping_cost column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Recalculate total formula note:
-- total = subtotal - discount + tax + shipping_cost
-- This is handled in application code, not a generated column
