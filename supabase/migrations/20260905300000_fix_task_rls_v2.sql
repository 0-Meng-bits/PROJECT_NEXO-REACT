-- ============================================================
-- FIX TASK ITEMS RLS POLICIES V2
-- Date: 2026-09-05
-- Purpose: Fix 403 error - simplified policy to verify membership
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Circle members can create tasks" ON task_items;
DROP POLICY IF EXISTS "Circle members can update tasks" ON task_items;
DROP POLICY IF EXISTS "Circle members can view tasks" ON task_items;
DROP POLICY IF EXISTS "Task creator or moderators can delete" ON task_items;

-- View policy: members can see tasks
CREATE POLICY "Circle members can view tasks"
  ON task_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM channels c
      JOIN memberships m ON m.community_id = c.community_id
      WHERE c.id = task_items.channel_id
      AND m.user_id = auth.uid()
    )
  );

-- Insert policy: members can create tasks
CREATE POLICY "Circle members can create tasks"
  ON task_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM channels c
      JOIN memberships m ON m.community_id = c.community_id
      WHERE c.id = channel_id
      AND m.user_id = auth.uid()
    )
  );

-- Update policy: members can update tasks
CREATE POLICY "Circle members can update tasks"
  ON task_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM channels c
      JOIN memberships m ON m.community_id = c.community_id
      WHERE c.id = task_items.channel_id
      AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM channels c
      JOIN memberships m ON m.community_id = c.community_id
      WHERE c.id = channel_id
      AND m.user_id = auth.uid()
    )
  );

-- Delete policy: creator or moderators can delete
CREATE POLICY "Task creator or moderators can delete"
  ON task_items FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 
      FROM channels c
      JOIN memberships m ON m.community_id = c.community_id
      WHERE c.id = task_items.channel_id
      AND m.user_id = auth.uid()
      AND m.rank_level >= 1
    )
  );

-- ============================================================
-- DONE! Policies reordered: channels -> memberships
-- ============================================================
