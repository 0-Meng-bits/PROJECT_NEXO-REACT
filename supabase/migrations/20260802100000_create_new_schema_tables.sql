-- ═══════════════════════════════════════════════════════════════════
-- STEP 1: CREATE NEW NORMALIZED TABLES
-- These run alongside profiles (no data loss, no downtime)
-- ═══════════════════════════════════════════════════════════════════

-- ── ACCOUNTS (core identity) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id          uuid PRIMARY KEY,                          -- same UUID as profiles.id / auth.users.id
  ctu_id      text UNIQUE NOT NULL,                      -- was: student_id
  full_name   text NOT NULL,
  email       text,
  user_type   text CHECK (user_type IN ('Student', 'Faculty', 'Admin')),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own account" ON accounts;
CREATE POLICY "Users can read own account"
  ON accounts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own account" ON accounts;
CREATE POLICY "Users can update own account"
  ON accounts FOR UPDATE USING (auth.uid() = id);


-- ── ACCOUNT_STATUS (moderation / verification state) ─────────────────
CREATE TABLE IF NOT EXISTS account_status (
  id               uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  is_verified      boolean DEFAULT false,
  is_banned        boolean DEFAULT false,
  suspended_until  timestamptz,
  warning_count    int DEFAULT 0,
  trust_points     int DEFAULT 0
);

ALTER TABLE account_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own status" ON account_status;
CREATE POLICY "Users can read own status"
  ON account_status FOR SELECT USING (true);


-- ── ACCOUNT_DETAILS (profile / academic info) ────────────────────────
CREATE TABLE IF NOT EXISTS account_details (
  id                  uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  department          text,
  course              text,
  year_level          text,
  interests           text[],
  avatar_url          text,
  cover_url           text,
  id_photo_url        text,
  id_verified         boolean DEFAULT false,
  last_seen           timestamptz,
  onboarding_complete boolean DEFAULT false
);

ALTER TABLE account_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own details" ON account_details;
CREATE POLICY "Users can read own details"
  ON account_details FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own details" ON account_details;
CREATE POLICY "Users can update own details"
  ON account_details FOR UPDATE USING (auth.uid() = id);


-- ═══════════════════════════════════════════════════════════════════
-- STEP 2: COPY DATA FROM profiles INTO THE NEW TABLES
-- ═══════════════════════════════════════════════════════════════════

-- accounts
INSERT INTO accounts (id, ctu_id, full_name, email, user_type, created_at)
SELECT id, student_id, full_name, email, user_type, created_at
FROM profiles
ON CONFLICT (id) DO NOTHING;

-- account_status
INSERT INTO account_status (id, is_verified)
SELECT id, COALESCE(is_verified, false)
FROM profiles
ON CONFLICT (id) DO NOTHING;

-- account_details
INSERT INTO account_details (id, course, year_level, interests, avatar_url, cover_url, id_photo_url, last_seen)
SELECT
  id,
  course,
  year_level,
  interests,
  avatar_url,
  cover_url,
  id_photo_url,
  last_seen
FROM profiles
ON CONFLICT (id) DO NOTHING;
