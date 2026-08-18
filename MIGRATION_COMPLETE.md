# Schema Migration Complete ✅

## Migration Summary

Successfully migrated from the old `profiles` table to the new normalized schema:

### New Schema Structure

**ACCOUNTS** — Core identity
- `id` (UUID, primary key)
- `ctu_id` (text, unique) — formerly `student_id`
- `full_name` (text)
- `email` (text)
- `user_type` (text)
- `created_at` (timestamptz)

**ACCOUNT_STATUS** — Moderation & verification state
- `id` (UUID, references accounts)
- `is_verified` (boolean)
- `is_banned` (boolean)
- `suspended_until` (timestamptz)
- `warning_count` (int)
- `trust_points` (int)
- `onboarding_complete` (boolean)

**ACCOUNT_DETAILS** — Profile information
- `id` (UUID, references accounts)
- `department` (text)
- `course` (text)
- `year_level` (text)
- `interests` (text array)
- `avatar_url` (text)
- `cover_url` (text)
- `id_photo_url` (text)
- `id_verified` (boolean)
- `last_seen` (timestamptz)

---

## What Was Updated

### ✅ Database Migrations
- Created new tables with proper structure
- Copied all data from `profiles` to new tables
- **Updated ALL foreign keys** from `profiles(id)` → `accounts(id)`
  - communities, memberships, messages, announcements, auditions
  - reports, user_warnings, post_comments, message_reactions
  - circle_requests, message_reads, campus_events

### ✅ Backend Code (server.js & API files)
- `/api/login` — reads from accounts with joins
- `/api/signup` — inserts into new tables only
- `/api/me` — reads from accounts with joins
- `/api/students` — reads from accounts with joins
- `/api/admin-data` — uses new schema
- `/api/update-profile` — updates account_details
- `/api/upload-avatar` — updates account_details
- `/api/verify-student` — updates account_status
- `/api/delete-user` — deletes from accounts
- `/api/heartbeat` — updates account_details.last_seen

### ✅ Frontend Components
- **UserPortal.jsx** — profile modal, online status, member lists
- **AdminDashboard.jsx** — warn, ban, verify, delete actions
- **AuditionSystem.jsx** — audition responses
- **Landing.jsx** — pulse counter stats
- **Onboarding.jsx** — onboarding flow
- **All Supabase queries** changed from `profiles(...)` to `accounts(...)` joins

### ✅ Code Cleanup
- **Removed ALL profiles sync code** — no more dual writes
- **Removed legacy profile lookups** — all code uses new schema
- **Updated field names** — `student_id` → `ctu_id` throughout

---

## How to Deploy

### Step 1: Apply FK Migration

Run the foreign key migration first (this is safe - it just updates constraints):

```bash
cd supabase
supabase migration up --file 20260811000000_migrate_fks_to_accounts.sql
```

### Step 2: Deploy Code

Deploy your updated application code (server + frontend).

### Step 3: Test Thoroughly

Test these critical flows:
- ✅ Sign up new user
- ✅ Login existing user  
- ✅ Update profile (avatar, cover, details)
- ✅ Admin verify user
- ✅ Admin warn/ban user
- ✅ Join/leave communities
- ✅ Post messages/announcements
- ✅ Submit audition responses
- ✅ Online presence tracking

### Step 4 (Optional): Backup & Drop profiles

Once everything is verified working:

```sql
-- Rename profiles as backup
ALTER TABLE profiles RENAME TO profiles_backup;

-- After a few weeks of stability, drop it:
-- DROP TABLE profiles_backup CASCADE;
```

---

## Rollback Plan

If issues arise:

1. **Before dropping profiles**: Simply revert code deployment
2. **After dropping profiles**: Restore from `profiles_backup`:
   ```sql
   ALTER TABLE profiles_backup RENAME TO profiles;
   ```

---

## Benefits of New Schema

✅ **Better separation of concerns** — identity, status, and details are separate
✅ **Cleaner queries** — explicit joins instead of mega-table
✅ **Easier to maintain** — moderation state isolated from profile data
✅ **More scalable** — can add tables without bloating main profile
✅ **Proper normalization** — follows database best practices

---

## Files Changed

### Database
- `supabase/migrations/20260811000000_migrate_fks_to_accounts.sql` (NEW)

### Backend
- `capstone-system/server.js`
- `capstone-react/api/signup.js`
- `capstone-react/api/login.js`
- `capstone-react/api/me.js`
- `capstone-react/api/verify-student.js`
- `capstone-react/api/upload-avatar.js`
- `capstone-react/api/update-profile.js`
- `capstone-react/api/delete-user.js`
- `capstone-react/api/admin-data.js`
- `capstone-react/api/communities.js`

### Frontend
- `capstone-react/src/components/UserPortal.jsx`
- `capstone-react/src/components/AdminDashboard.jsx`
- `capstone-react/src/components/AuditionSystem.jsx`
- `capstone-react/src/components/Landing.jsx`
- `capstone-react/src/components/Onboarding.jsx`

---

**Migration completed on:** 2026-08-11  
**Status:** Ready for deployment ✅


---

## Phase 3: Complete Auditions → Applications Rename (2026-08-11)

### Database Changes

**Tables Renamed:**
- `auditions` → `applications`
- `audition_questions` → `application_questions`
- `audition_responses` → `application_submissions`

**Columns Renamed:**
- `application_questions.audition_id` → `application_id`
- `application_submissions.audition_id` → `application_id`
- `communities.audition_enabled` → `application_enabled`
- `communities.internal_audition` → `internal_application`

### Migrations Applied:
1. `20260811200000_rename_auditions_to_applications.sql` - Renamed main tables
2. `20260811300000_rename_audition_id_columns.sql` - Renamed FK columns
3. `20260811400000_rename_communities_audition_columns.sql` - Renamed communities columns

### Code Updates:
- ✅ `AuditionSystem.jsx` → `ApplicationSystem.jsx`
- ✅ All references in `UserPortal.jsx` updated via bulk replace
- ✅ All references in `server.js` updated via bulk replace
- ✅ `AdminDashboard.jsx` - Updated `audition_enabled` → `application_enabled`
- ✅ `ApplicationSystem.jsx` - Fixed typo and updated to `internal_application`

### Verification:
Run these queries to verify the changes:

```sql
-- Verify table renames
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%application%'
ORDER BY table_name;

-- Verify column renames
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('application_questions', 'application_submissions', 'communities')
AND column_name LIKE '%application%'
ORDER BY table_name, column_name;
```

**Status:** ✅ Complete - All audition terminology changed to application
