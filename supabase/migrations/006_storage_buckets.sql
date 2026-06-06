-- ============================================================
-- SUPABASE STORAGE BUCKETS
-- Run this in the Supabase SQL editor after migrations
-- ============================================================

-- Product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Expense invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-invoices', 'expense-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Backups (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE POLICIES
-- ============================================================

-- Product images: anyone can read, authenticated can upload
CREATE POLICY "product_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "product_images_auth_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "product_images_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- Logos: public read, authenticated upload
CREATE POLICY "logos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

CREATE POLICY "logos_auth_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

-- Expense invoices: authenticated only
CREATE POLICY "expense_invoices_auth"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'expense-invoices')
WITH CHECK (bucket_id = 'expense-invoices');

-- Task attachments: authenticated only
CREATE POLICY "task_attachments_auth"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'task-attachments')
WITH CHECK (bucket_id = 'task-attachments');

-- Backups: authenticated only (server enforces founder check)
CREATE POLICY "backups_auth"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'backups')
WITH CHECK (bucket_id = 'backups');
