-- ============================================================
-- SHOWCASE FEEDBACK SYSTEM
-- Date: 2026-09-27
-- Purpose: Enable structured feedback tags for hobby showcase posts
-- ============================================================

-- ── 1. CREATE SHOWCASE_FEEDBACK TABLE ──────────────────────

CREATE TABLE showcase_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag_type text NOT NULL CHECK (tag_type IN ('effort', 'creative', 'technique', 'style', 'impact')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(announcement_id, user_id, tag_type)
);

-- ── 2. CREATE INDEXES ───────────────────────────────────────

-- Index for fast tag count queries by announcement
CREATE INDEX idx_showcase_feedback_announcement     
  ON showcase_feedback(announcement_id);

-- Index for checking if user already tagged specific announcement
CREATE INDEX idx_showcase_feedback_user 
  ON showcase_feedback(user_id, announcement_id);

-- ── 3. ENABLE ROW LEVEL SECURITY ────────────────────────────

ALTER TABLE showcase_feedback ENABLE ROW LEVEL SECURITY;

-- ── 4. CREATE RLS POLICIES ──────────────────────────────────

-- Anyone can view feedback tags (public data)
CREATE POLICY "Anyone can view showcase feedback"
  ON showcase_feedback FOR SELECT
  USING (true);

-- Users can only insert their own feedback tags
CREATE POLICY "Users can add their own feedback"
  ON showcase_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own feedback tags
CREATE POLICY "Users can remove their own feedback"
  ON showcase_feedback FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- END OF MIGRATION
-- ============================================================
