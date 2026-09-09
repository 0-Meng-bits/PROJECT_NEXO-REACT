-- Run this in Supabase SQL Editor to check if you're a member
-- This will show your user ID and memberships

SELECT 
  auth.uid() as "my_auth_uid",
  (SELECT id FROM accounts WHERE id = auth.uid()) as "my_account_id",
  m.community_id,
  c.name as "circle_name",
  ch.id as "channel_id",
  ch.name as "channel_name"
FROM memberships m
JOIN communities c ON c.id = m.community_id
LEFT JOIN channels ch ON ch.community_id = m.community_id
WHERE m.user_id = auth.uid()
ORDER BY c.name, ch.name;
