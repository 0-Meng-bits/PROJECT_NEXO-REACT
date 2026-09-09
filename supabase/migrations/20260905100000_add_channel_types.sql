-- ============================================================
-- ENHANCED CHANNEL TYPES
-- Date: 2026-09-05
-- Purpose: Add different channel types (gallery, files, notes, tasks)
-- ============================================================

-- ── 1. ADD CHANNEL TYPE COLUMN ───────────────────────────────
ALTER TABLE channels 
ADD COLUMN IF NOT EXISTS channel_type text DEFAULT 'chat' 
CHECK (channel_type IN ('chat', 'gallery', 'files', 'notes', 'tasks'));

-- ── 2. TASK ITEMS TABLE ──────────────────────────────────────
-- For task-type channels
CREATE TABLE IF NOT EXISTS task_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES accounts(id) ON DELETE SET NULL,
  status text DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date timestamptz,
  created_by uuid REFERENCES accounts(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- ── 3. RLS POLICIES ──────────────────────────────────────────

-- Task items: members of the circle can view
CREATE POLICY "Circle members can view tasks"
  ON task_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = task_items.channel_id
      AND m.user_id = auth.uid()
    )
  );

-- Task items: members can create tasks
CREATE POLICY "Circle members can create tasks"
  ON task_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = task_items.channel_id
      AND m.user_id = auth.uid()
    )
  );

-- Task items: members can update tasks
CREATE POLICY "Circle members can update tasks"
  ON task_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = task_items.channel_id
      AND m.user_id = auth.uid()
    )
  );

-- Task items: creator or moderators can delete
CREATE POLICY "Task creator or moderators can delete"
  ON task_items FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = task_items.channel_id
      AND m.user_id = auth.uid()
      AND m.rank_level >= 1
    )
  );

-- ── 4. INDEXES ───────────────────────────────────────────────
CREATE INDEX idx_channels_type ON channels(channel_type);
CREATE INDEX idx_task_items_channel ON task_items(channel_id);
CREATE INDEX idx_task_items_assigned ON task_items(assigned_to);
CREATE INDEX idx_task_items_status ON task_items(status);
CREATE INDEX idx_task_items_due_date ON task_items(due_date);

-- ── 5. ENABLE RLS ────────────────────────────────────────────
ALTER TABLE task_items ENABLE ROW LEVEL SECURITY;

-- ── 6. UPDATE EXISTING CHANNELS ──────────────────────────────
-- Set existing channels to 'chat' type (default)
UPDATE channels SET channel_type = 'chat' WHERE channel_type IS NULL;

-- ============================================================
-- DONE! Channels now support different types
-- ============================================================

-- USAGE EXAMPLES:
-- 
-- Create a gallery channel:
--   INSERT INTO channels (community_id, name, channel_type) 
--   VALUES (..., 'Photo Gallery', 'gallery');
--
-- Create a task channel:
--   INSERT INTO channels (community_id, name, channel_type) 
--   VALUES (..., 'Project Tasks', 'tasks');
--
-- Add a task:
--   INSERT INTO task_items (channel_id, title, description, assigned_to, due_date, created_by)
--   VALUES (..., 'Design poster', 'Create event poster', user_id, '2026-09-10', creator_id);
