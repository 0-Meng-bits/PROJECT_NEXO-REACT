-- Debug: Check why events aren't showing

-- 1. Check all campus events with their community info
SELECT 
  ce.id,
  ce.title,
  ce.event_date,
  ce.community_id,
  c.name as circle_name,
  ce.is_official,
  ce.description
FROM campus_events ce
LEFT JOIN communities c ON c.id = ce.community_id
WHERE ce.event_date >= CURRENT_DATE
ORDER BY ce.event_date;

-- 2. Check your memberships (replace YOUR_USER_ID with actual user ID)
-- Find your user ID first:
SELECT id, ctu_id, full_name, user_type 
FROM accounts 
WHERE ctu_id = '21-1234-567'  -- Replace with your student ID
LIMIT 1;

-- 3. Check memberships for a specific user (use the ID from step 2)
SELECT 
  m.user_id,
  m.community_id,
  m.status,
  m.rank_level,
  c.name as circle_name
FROM memberships m
JOIN communities c ON c.id = m.community_id
WHERE m.user_id = 'YOUR_USER_ID_HERE'  -- Replace with actual UUID
  AND m.status = 'approved';

-- 4. Test RLS policy manually - Check if you can see events
-- (This simulates what the frontend query does)
SET LOCAL jwt.claims.sub = 'YOUR_USER_ID_HERE';  -- Replace with your user UUID
SET LOCAL ROLE authenticated;

SELECT 
  ce.id,
  ce.title,
  ce.event_date,
  ce.community_id,
  c.name as circle_name
FROM campus_events ce
LEFT JOIN communities c ON c.id = ce.community_id
WHERE ce.event_date >= CURRENT_DATE;

RESET ROLE;
