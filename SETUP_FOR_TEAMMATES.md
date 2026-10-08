# Database Setup Guide for Team Members

Last updated: 2026-10-04

## Quick Start (5 minutes)

### Step 1 — Pull the latest code

```bash
git pull origin main
```

### Step 2 — Set up your Supabase project

Go to [supabase.com](https://supabase.com), create a new project (or use an existing one).

### Step 3 — Run the schema

1. Go to your project → SQL Editor
2. Open `COMPLETE_SCHEMA.sql` from the repo root
3. Copy the entire file and paste it into the SQL Editor
4. Click Run

That's it. All 29 tables, indexes, RLS policies, storage buckets, and default shop items are set up in one shot.

### Step 4 — Configure your .env

Copy the `.env` file template and fill in your Supabase credentials:

```bash
cd capstone-react
cp .env.example .env   # if it exists, otherwise ask a teammate for the .env values
```

You need:
- `VITE_SUPABASE_URL` — your project URL (Project Settings → API)
- `VITE_SUPABASE_ANON_KEY` — your anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — your service role key (for the API)

### Step 5 — Run the dev server

```bash
cd capstone-react
npm install
npm run dev
```

---

## Important Notes

### Do NOT run the old migrations folder

The `supabase/migrations/` folder has 59 files spanning months of incremental changes. Some of them reference old table names like `profiles` and `auditions` that no longer exist. Running them on a fresh database will break.

Use `COMPLETE_SCHEMA.sql` instead — it is the single source of truth and reflects the full current schema.

### What's in the schema

- Core user tables: `accounts`, `account_status`, `account_details`
- Community tables: `communities`, `memberships`, `channels`, `circle_requests`
- Messaging: `messages`, `message_reads`, `message_reactions`
- Content: `announcements`, `post_comments`, `showcase_feedback`
- Applications: `applications`, `application_questions`, `application_submissions`
- Events: `campus_events`, `notifications`
- Moderation: `reports`, `user_warnings`, `user_flags`, `warning_appeals`, `abuse_patterns`
- Trust points: `point_transactions`, `appreciation_cooldowns`
- Shop: `shop_items`, `user_purchases`, `user_profile_settings`
- Tasks: `task_items`
- Storage buckets: `avatars`, `chat-media`

### Troubleshooting

**"Table already exists" error** — Your database already has some tables. Either drop the schema first or just skip those errors; the schema uses `CREATE TABLE IF NOT EXISTS` so existing tables won't be overwritten.

To start fully fresh (deletes all data):
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```
Then re-run `COMPLETE_SCHEMA.sql`.

**"Permission denied" error** — Make sure your backend is using the `service_role` key, not the `anon` key.

**Login/signup not working** — Make sure Supabase Auth is enabled in your project (Authentication → Settings). Email confirmations can be turned off for local dev.
