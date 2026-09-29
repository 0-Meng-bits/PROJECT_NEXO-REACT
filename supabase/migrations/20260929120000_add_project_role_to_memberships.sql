-- ============================================================
-- ADD PROJECT ROLE TO MEMBERSHIPS
-- Date: 2026-09-29
-- Purpose: Add role classification for project circle members
-- ============================================================

-- Add project_role column to memberships table
-- This enables role-based task organization in project communities
ALTER TABLE memberships 
ADD COLUMN project_role text 
CHECK (project_role IN ('Leader', 'Developer', 'Designer', 'Tester', 'Other'));

-- Column is nullable by default (NULL = "No Role" state)
-- Valid values: 'Leader', 'Developer', 'Designer', 'Tester', 'Other'
-- Only meaningful for communities with category='project'


-- ============================================================
-- RLS POLICY: Only community leaders can update member roles
-- ============================================================

-- Policy: Community leaders can update membership rows (including project_role)
-- Checks caller's membership via auth.uid() to ensure they're a leader in the same community
CREATE POLICY "Community leaders can update member roles"
  ON memberships FOR UPDATE
  TO authenticated
  USING (
    -- Caller must be a leader (rank_level >= 1) in the same community
    EXISTS (
      SELECT 1 FROM memberships caller_membership
      WHERE caller_membership.user_id = auth.uid()
      AND caller_membership.community_id = memberships.community_id
      AND caller_membership.rank_level >= 1
      AND caller_membership.status = 'approved'
    )
  )
  WITH CHECK (
    -- Same check for post-update state
    EXISTS (
      SELECT 1 FROM memberships caller_membership
      WHERE caller_membership.user_id = auth.uid()
      AND caller_membership.community_id = memberships.community_id
      AND caller_membership.rank_level >= 1
      AND caller_membership.status = 'approved'
    )
  );

-- ============================================================
-- DONE! Project role column and RLS policy added
-- ============================================================
