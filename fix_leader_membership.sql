-- Fix: Add leader as member of their own circle
-- Run this in Supabase SQL Editor

-- Add you as a member of llkglkgn circle with leader rank
INSERT INTO memberships (user_id, community_id, rank_level, joined_at)
SELECT 
  auth.uid() as user_id,
  'fc927338-c0fd-45bd-8217-6f9033ebc2c8' as community_id,
  2 as rank_level,  -- 2 = leader
  now() as joined_at
WHERE NOT EXISTS (
  SELECT 1 FROM memberships 
  WHERE user_id = auth.uid() 
  AND community_id = 'fc927338-c0fd-45bd-8217-6f9033ebc2c8'
);

-- Verify it worked
SELECT 
  m.user_id,
  m.community_id,
  c.name as circle_name,
  m.rank_level,
  CASE 
    WHEN m.rank_level = 2 THEN '👑 LEADER'
    WHEN m.rank_level = 1 THEN '⭐ MODERATOR'
    ELSE '👤 MEMBER'
  END as role
FROM memberships m
JOIN communities c ON c.id = m.community_id
WHERE m.user_id = auth.uid();
