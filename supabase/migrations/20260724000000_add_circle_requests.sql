-- Circle creation requests table
CREATE TABLE IF NOT EXISTS circle_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  category    TEXT DEFAULT 'academic',
  icon        TEXT DEFAULT 'fa-solid fa-graduation-cap',
  creator_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id)
);

-- RLS
ALTER TABLE circle_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own requests
CREATE POLICY "Users can create circle requests"
  ON circle_requests FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Users can view their own requests
CREATE POLICY "Users can view own circle requests"
  ON circle_requests FOR SELECT
  USING (auth.uid() = creator_id);

-- Admins can view and update all requests (handled via service role in API)
