# 🚀 Database Setup Guide for Team Members

## Quick Start (5 minutes)

Your teammate has updated the database schema. Follow these steps to sync your local/dev environment:

---

## Option 1: Fresh Database Setup (RECOMMENDED - Easiest) ✨

**Use this if you want to start fresh with the new schema.**

### Steps:

1. **Pull the latest code from GitHub:**
   ```bash
   git pull origin main
   ```````

2. **Go to your Supabase Project:**
   - Log in to [supabase.com](https://supabase.com)
   - Open your project

3. **Run the complete schema:**
   - Go to **SQL Editor** in the left sidebar
   - Open the file `COMPLETE_SCHEMA.sql` from the repo
   - Copy all the content
   - Paste it into the SQL Editor
   - Click **Run** or press `Ctrl+Enter`

4. **Done!** ✅
   - Your database now has all the new tables
   - All foreign keys are set up
   - Storage buckets are configured

---

## Option 2: Run Migrations (For Advanced Users)

**Use this if you want to keep existing data and migrate step-by-step.**

### Prerequisites:
- Supabase CLI installed
- Connection to your Supabase project

### Steps:

1. **Pull the latest code:**
   ```bash
   git pull origin main
   ```

2. **Link to your Supabase project:**
   ```bash
   cd supabase
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

3. **Push migrations:**
   ```bash
   npx supabase db push
   ```

4. **Verify:**
   ```sql
   -- Run this in SQL Editor to check tables
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('accounts', 'account_status', 'account_details',
                      'applications', 'application_questions', 'application_submissions')
   ORDER BY table_name;
   ```

---

## What Changed?

### Major Schema Updates:

1. **profiles → accounts** (Normalized)
   - Old: Single `profiles` table
   - New: Split into 3 tables:
     - `accounts` - Core identity
     - `account_status` - Verification/moderation
     - `account_details` - Profile info

2. **auditions → applications** (Terminology)
   - `auditions` → `applications`
   - `audition_questions` → `application_questions`
   - `audition_responses` → `application_submissions`

3. **New columns:**
   - `communities.application_enabled`
   - `communities.internal_application`
   - `account_details.last_seen`
   - `account_details.cover_url`

### All Code Updated:
✅ Backend API (server.js)
✅ Frontend components
✅ All foreign keys migrated
✅ Storage buckets configured

---

## Testing Your Setup

After running the setup, test these:

1. **Check tables exist:**
   ```sql
   SELECT count(*) FROM accounts;
   SELECT count(*) FROM communities;
   SELECT count(*) FROM applications;
   ```

2. **Run the dev server:**
   ```bash
   cd capstone-react
   npm install  # If there are new dependencies
   npm run dev
   ```

3. **Try logging in/signing up** to verify everything works

---

## Troubleshooting

### "Table already exists" error
- You already have some tables. Use **Option 2** (migrations) instead, or:
- Drop your existing database tables first (⚠️ This deletes all data):
  ```sql
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  ```
  Then re-run `COMPLETE_SCHEMA.sql`

### "Permission denied" error
- Make sure you're using **service_role** key in your backend
- Check that RLS policies are set up (they're in the schema file)

### FK constraint errors
- Run the complete schema file from scratch
- Or check if any old `profiles` references still exist

---

## Need Help?

Ask your teammate who made these changes! They have the full context. 😊

**Files to reference:**
- `COMPLETE_SCHEMA.sql` - Full database schema
- `MIGRATION_COMPLETE.md` - Documentation of what changed
- `DATABASE_SCHEMA.md` - Schema reference

---

**Estimated Time:** 5-10 minutes for Option 1 (fresh setup)
