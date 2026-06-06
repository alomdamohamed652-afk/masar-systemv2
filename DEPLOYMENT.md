# MASAR Brand Manager V2 — Deployment Guide

## Prerequisites
- Node.js 20+
- Supabase project (free tier works)
- Render account (free tier works)

---

## Step 1 — Supabase Setup

### 1.1 Create a Supabase project
1. Go to https://supabase.com and create a new project
2. Choose a region close to your users (Frankfurt recommended for Egypt/KSA)
3. Save your project URL and keys

### 1.2 Configure Auth
1. Go to **Authentication → Settings**
2. Set **Site URL** to your Render URL (e.g. `https://masar.onrender.com`)
3. Add redirect URLs: `https://masar.onrender.com/**`
4. **Disable "Confirm email"** under Authentication → Email → uncheck "Confirm email"
   - Users are created by the Founder, not self-registered
5. Under Authentication → Email Templates, update as needed

### 1.3 Run Migrations (in order)
Go to **SQL Editor** and run each file:

```
supabase/migrations/001_core_system.sql
supabase/migrations/002_products_inventory.sql
supabase/migrations/003_orders_customers.sql
supabase/migrations/004_hr_tasks.sql
supabase/migrations/005_logs_system.sql
supabase/migrations/006_storage_buckets.sql
```

### 1.4 Create the Founder user
In the Supabase **Authentication → Users** tab:
1. Click "Add User" → "Create new user"
2. Enter email and password
3. Then in SQL Editor, update their profile:

```sql
UPDATE profiles
SET name = 'اسمك هنا', role = 'founder', phone = '01xxxxxxxxx'
WHERE email = 'your@email.com';
```

### 1.5 Get your API keys
From **Project Settings → API**:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2 — Local Development

```bash
# Clone or extract the project
cd masar

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Fill in your Supabase credentials

# Run development server
npm run dev
# Open http://localhost:3000
```

---

## Step 3 — Render Deployment

### 3.1 Push to GitHub
```bash
git init
git add .
git commit -m "Initial MASAR v2"
git remote add origin https://github.com/yourname/masar.git
git push -u origin main
```

### 3.2 Create Render Web Service
1. Go to https://render.com → New → Web Service
2. Connect your GitHub repo
3. Configure:
   - **Name**: `masar-brand-manager`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

### 3.3 Set Environment Variables in Render
```
NEXT_PUBLIC_SUPABASE_URL         = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY    = eyJ...
SUPABASE_SERVICE_ROLE_KEY        = eyJ...
NEXT_PUBLIC_APP_URL              = https://your-app.onrender.com
NODE_ENV                         = production
```

### 3.4 Deploy
Render will auto-deploy on every push to main.

---

## Step 4 — Post-Deployment Checklist

- [ ] Login works with email + password
- [ ] Login works with phone number (after setting phone in profile)
- [ ] Dashboard loads under 2 seconds
- [ ] Products page loads and shows empty state
- [ ] Can create a warehouse
- [ ] Can create a product with variants
- [ ] Can add inventory movement (verifies warehouse_stocks trigger)
- [ ] Can create an order
- [ ] Order status change to "processing" deducts stock
- [ ] WhatsApp button opens correct link
- [ ] Activity log recorded after login
- [ ] Audit log recorded after price change
- [ ] JSON backup created and downloadable
- [ ] Settings save correctly and timezone is applied

---

## Supabase Free Tier Limits
- Database: 500MB (sufficient for thousands of orders)
- Storage: 1GB (sufficient for product images + backups)
- API calls: 500K/month
- Auth users: 50,000

---

## Data Persistence on Render Free Tier
⚠️ Render free instances sleep after 15 minutes of inactivity.
✅ All data is in Supabase (PostgreSQL + Storage) — never on Render disk.
✅ Restarts and instance replacements cause zero data loss.
✅ No local file storage anywhere in the codebase.

---

## Phone Login Setup
For a user to log in with phone number:
1. Set their `phone` in the `profiles` table (format: `01012345678` or `+201012345678`)
2. The login page resolves phone → email automatically via `/api/auth/resolve-phone`
3. Supabase Auth is used for the actual password verification (email flow)

---

## Wuilt Integration (Pending)
The integration placeholder is ready:
- API key stored in `integrations` table
- `orders.external_id` and `orders.source` columns exist for idempotency
- When Wuilt API docs are available, implement: `src/app/api/integrations/wuilt/sync/route.ts`

---

## Backup & Recovery
- Create backups from `/backups` page (Founder only)
- Files stored in `backups` bucket in Supabase Storage
- To restore: download the JSON file and use Supabase SQL to re-import tables
- PostgreSQL-level backup: use Supabase Dashboard → Database → Backups (paid plans)
