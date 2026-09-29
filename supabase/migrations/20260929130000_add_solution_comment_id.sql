-- ============================================================
-- ADD SOLUTION COMMENT ID TO ANNOUNCEMENTS
-- Date: 2026-09-29
-- Purpose: Enable Q&A solved marking for academic circles
-- ============================================================

-- Add solution_comment_id to announcements table
-- NULL = unsolved, non-null = solved (points to accepted comment)
-- ON DELETE SET NULL: if solution comment is deleted, question reverts to unsolved
ALTER TABLE announcements
ADD COLUMN solution_comment_id uuid
REFERENCES post_comments(id) ON DELETE SET NULL;

-- ============================================================
-- RLS POLICY: Only OP or community creator can mark solutions
-- ============================================================

-- Checks auth.uid() server-side — no client-supplied user ID
-- Creator override applies regardless of OP's current membership status
CREATE POLICY "OP or creator can mark solution"
  ON announcements FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = announcements.community_id
      AND communities.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = announcements.community_id
      AND communities.creator_id = auth.uid()
    )
  );

-- ============================================================
-- DONE! Run this in Supabase SQL Editor
-- ============================================================
