-- ============================================================
-- POLL-TO-EVENT CONVERSION SYSTEM
-- Date: 2026-09-27
-- Purpose: Enable automatic event generation from poll results in social communities
-- ============================================================

-- ── 1. ADD EVENT_METADATA COLUMN TO ANNOUNCEMENTS ──────────

ALTER TABLE announcements 
  ADD COLUMN IF NOT EXISTS event_metadata jsonb;

-- ── 2. CREATE INDEXES ───────────────────────────────────────

-- Index for quickly finding polls with event capability
CREATE INDEX IF NOT EXISTS idx_announcements_event_metadata 
  ON announcements(event_metadata) 
  WHERE event_metadata IS NOT NULL;

-- Index for finding social community polls
CREATE INDEX IF NOT EXISTS idx_announcements_social_polls 
  ON announcements(community_id, post_type) 
  WHERE post_type = 'poll';

-- ============================================================
-- END OF MIGRATION
-- ============================================================
