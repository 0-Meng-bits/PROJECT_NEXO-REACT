-- Fix RLS policy to check for 'active' status instead of 'approved'
-- The codebase uses 'active' for members, not 'approved'

-- Drop the existing policy
DROP POLICY IF EXISTS "Users see campus-wide or their circle events" ON campus_events;

-- Create new policy with correct status check
CREATE POLICY "Users see campus-wide or their circle events"
ON campus_events FOR SELECT
USING (
  -- Campus-wide events (community_id IS NULL) visible to everyone
  community_id IS NULL
  OR
  -- Circle events visible only to active members
  EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.community_id = campus_events.community_id
      AND memberships.user_id = auth.uid()
      AND memberships.status = 'active'  -- Changed from 'approved' to 'active'
  )
);

-- Verify the policy was created
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'campus_events' 
  AND policyname = 'Users see campus-wide or their circle events';
