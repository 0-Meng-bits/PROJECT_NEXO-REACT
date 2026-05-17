-- ── REPORTS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content_type text CHECK (content_type IN ('message', 'announcement', 'user', 'circle')),
  content_id text,          -- id of the reported message/announcement/etc
  content_preview text,     -- snippet of the reported content
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  admin_note text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id)
);

-- ── USER WARNINGS / BANS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_warnings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES profiles(id),
  type text DEFAULT 'warning' CHECK (type IN ('warning', 'ban')),
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ── BAN FLAG ON PROFILES ──────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS warning_count int DEFAULT 0;
