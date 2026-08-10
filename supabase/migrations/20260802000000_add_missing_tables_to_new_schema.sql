-- ── CIRCLE REQUESTS ─────────────────────────────────────────────────────────
-- Tracks circle creation requests pending admin approval
CREATE TABLE IF NOT EXISTS circle_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text DEFAULT '',
  category    text DEFAULT 'academic',
  icon        text DEFAULT 'fa-solid fa-graduation-cap',
  creator_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note  text DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id)
);

ALTER TABLE circle_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create circle requests" ON circle_requests;
CREATE POLICY "Users can create circle requests"
  ON circle_requests FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Users can view own circle requests" ON circle_requests;
CREATE POLICY "Users can view own circle requests"
  ON circle_requests FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can update circle requests" ON circle_requests;
CREATE POLICY "Admins can update circle requests"
  ON circle_requests FOR UPDATE
  USING (true);


-- ── MESSAGE READS ────────────────────────────────────────────────────────────
-- Tracks which messages have been read by which users (for seen receipts)
CREATE TABLE IF NOT EXISTS message_reads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reader_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at    timestamptz DEFAULT now(),
  UNIQUE(message_id, reader_id)
);

ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own reads" ON message_reads;
CREATE POLICY "Users can insert own reads"
  ON message_reads FOR INSERT
  WITH CHECK (auth.uid() = reader_id);

DROP POLICY IF EXISTS "Users can read all reads" ON message_reads;
CREATE POLICY "Users can read all reads"
  ON message_reads FOR SELECT
  USING (true);


-- ── MISSING COLUMNS ON EXISTING TABLES ──────────────────────────────────────
-- profiles: cover photo, online presence, community logo, post author tracking
ALTER TABLE profiles    ADD COLUMN IF NOT EXISTS cover_url         text;
ALTER TABLE profiles    ADD COLUMN IF NOT EXISTS last_seen         timestamptz;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS logo_url          text;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS author_student_id text REFERENCES profiles(student_id);
ALTER TABLE messages    ADD COLUMN IF NOT EXISTS edited            boolean DEFAULT false;
