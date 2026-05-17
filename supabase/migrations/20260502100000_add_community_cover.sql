-- Add cover photo support to communities
ALTER TABLE communities ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Allow authenticated users to update communities they created
-- (service role bypasses this, but anon client needs it as fallback)
DROP POLICY IF EXISTS "Creator can update community cover" ON communities;
CREATE POLICY "Creator can update community cover"
  ON communities FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
