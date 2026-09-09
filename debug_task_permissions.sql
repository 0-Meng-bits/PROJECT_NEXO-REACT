-- Debug: Check if current user can create tasks in this channel
-- Replace YOUR_CHANNEL_ID with the actual channel ID from the project-tasks channel

-- Step 1: Find the channel ID for project-tasks
SELECT id, name, community_id, channel_type 
FROM channels 
WHERE name = 'project-tasks';

-- Step 2: Check if you're a member of the circle that owns this channel
-- Replace CHANNEL_ID_FROM_STEP_1 in the query below
SELECT 
  m.user_id,
  m.community_id,
  c.name as circle_name,
  m.rank_level,
  a.ctu_id,
  a.full_name
FROM memberships m
JOIN communities c ON c.id = m.community_id
JOIN accounts a ON a.id = m.user_id
WHERE m.community_id = (
  SELECT community_id FROM channels WHERE name = 'project-tasks' LIMIT 1
);

-- Step 3: Test the exact policy logic
-- This should return TRUE if you can create tasks
SELECT EXISTS (
  SELECT 1 FROM memberships m
  JOIN channels c ON c.community_id = m.community_id
  WHERE c.name = 'project-tasks'
  AND m.user_id = auth.uid()
) as "can_create_task";
