-- Debug why you can't see the event even though you're a member

-- 1. Check the exact RLS policy on campus_events
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'campus_events'
ORDER BY policyname;

-- 2. Check your membership status in introcertis (replace with your user ID)
-- First get your user ID:
SELECT id, ctu_id, full_name FROM accounts WHERE ctu_id = '21-1234-567';  -- REPLACE

-- Then check membership:
SELECT 
  m.user_id,
  m.community_id,
  m.status,
  m.rank_level,
  c.name as circle_name,
  CASE 
    WHEN m.status = 'approved' THEN '✓ Should see events'
    WHEN m.status = 'active' THEN '✓ Should see events' 
    ELSE '✗ Cannot see events'
  END as can_see_events
FROM memberships m
JOIN communities c ON c.id = m.community_id
WHERE m.user_id = 'YOUR_USER_ID'  -- REPLACE WITH ACTUAL UUID
  AND c.id = '7b470743-d08b-441a-b3eb-e2fae5eda712';  -- introcertis ID

-- 3. Check if status is 'approved' or 'active' (RLS checks for 'approved')
SELECT 
  m.status,
  COUNT(*) as count
FROM memberships m
WHERE m.community_id = '7b470743-d08b-441a-b3eb-e2fae5eda712'
GROUP BY m.status;

-- 4. Try to find the event with all details
SELECT 
  ce.*,
  c.name as circle_name
FROM campus_events ce
LEFT JOIN communities c ON c.id = ce.community_id
WHERE ce.title = 'marcos';
