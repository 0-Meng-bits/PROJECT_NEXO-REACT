-- ============================================================
-- CAMPUS EVENTS VIEWER: Add community_id for circle events
-- Date: 2026-09-28
-- Purpose: Enable circle-specific events with privacy enforcement
-- ============================================================

-- Add community_id column to campus_events
-- NULL = campus-wide event (visible to all)
-- NOT NULL = circle event (visible to members only)
ALTER TABLE campus_events 
ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES communities(id) ON DELETE CASCADE;

-- Add index for query performance (filtering + sorting)
-- Handle both column name variations (event_date vs start_date)
DO $$
BEGIN
  -- Try with event_date first (older schema)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campus_events' AND column_name = 'event_date'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_campus_events_community_date 
    ON campus_events(community_id, event_date);
  -- Otherwise use start_date (newer schema)
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campus_events' AND column_name = 'start_date'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_campus_events_community_date 
    ON campus_events(community_id, start_date);
  END IF;
END $$;

-- ============================================================
-- RLS POLICY CLEANUP
-- Drop ALL old permissive policies to prevent conflicts
-- ============================================================

DROP POLICY IF EXISTS "Anyone can read events" ON campus_events;
DROP POLICY IF EXISTS "Verified users can post events" ON campus_events;
DROP POLICY IF EXISTS "Admin and faculty can manage events" ON campus_events;
DROP POLICY IF EXISTS "Poster can delete own events" ON campus_events;

-- ============================================================
-- NEW PRIVACY-ENFORCED RLS POLICIES
-- ============================================================

-- SELECT: Users see campus-wide events OR their circle events only
CREATE POLICY "Users see campus-wide or their circle events"
ON campus_events FOR SELECT
USING (
  -- Campus-wide events (community_id IS NULL) visible to everyone
  community_id IS NULL
  OR
  -- Circle events visible only to approved members
  EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.community_id = campus_events.community_id
      AND memberships.user_id = auth.uid()
      AND memberships.status = 'approved'
  )
);

-- INSERT: No direct inserts from frontend (backend only)
-- Backend uses service role which bypasses RLS
-- Backend enforces admin/leader authorization before insert
CREATE POLICY "No direct inserts from frontend"
ON campus_events FOR INSERT
WITH CHECK (false);

-- DELETE: No direct deletes from frontend (backend only)
-- Backend uses service role which bypasses RLS
-- Backend enforces admin authorization before delete
CREATE POLICY "No direct deletes from frontend"
ON campus_events FOR DELETE
USING (false);

-- ============================================================
-- MIGRATION COMPLETE
-- Existing rows with community_id = NULL become campus-wide
-- Poll-to-event will now set community_id for circle events
-- ============================================================
