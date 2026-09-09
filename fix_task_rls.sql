-- Fix task_items RLS policies
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Circle members can create tasks" ON task_items;
DROP POLICY IF EXISTS "Circle members can update tasks" ON task_items;

-- Recreate INSERT policy with correct reference
CREATE POLICY "Circle members can create tasks"
  ON task_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = channel_id  -- Use the column being inserted, not task_items.channel_id
      AND m.user_id = auth.uid()
    )
  );

-- Recreate UPDATE policy  
CREATE POLICY "Circle members can update tasks"
  ON task_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = channel_id
      AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = channel_id
      AND m.user_id = auth.uid()
    )
  );
