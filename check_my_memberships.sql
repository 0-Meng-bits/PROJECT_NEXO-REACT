-- Find your user ID and check your circle memberships

-- Step 1: Find your account (replace with your actual student ID)
SELECT 
  id as user_id,
  ctu_id,
  full_name,
  user_type
FROM accounts
WHERE ctu_id = '21-1234-567'  -- REPLACE THIS WITH YOUR ACTUAL STUDENT ID
LIMIT 1;

-- Step 2: Check all your memberships (replace USER_ID_HERE with result from step 1)
SELECT 
  c.name as circle_name,
  c.id as circle_id,
  m.status,
  m.rank_level,
  m.role
FROM memberships m
JOIN communities c ON c.id = m.community_id
WHERE m.user_id = 'USER_ID_HERE'  -- REPLACE WITH YOUR USER UUID
ORDER BY c.name;

-- Step 3: Check if "Third TRY" exists as a circle and who's in it
SELECT 
  c.id,
  c.name,
  c.category,
  COUNT(m.user_id) as member_count
FROM communities c
LEFT JOIN memberships m ON m.community_id = c.id AND m.status = 'approved'
WHERE c.name LIKE '%Third%TRY%' OR c.name LIKE '%introcertis%'
GROUP BY c.id, c.name, c.category;

-- Step 4: Quick fix - Add yourself to introcertis circle if needed
-- (Uncomment and run this if you need to join introcertis)
/*
INSERT INTO memberships (user_id, community_id, status, role, rank_level)
VALUES (
  'YOUR_USER_ID_HERE',  -- Your UUID from step 1
  '7b470743-d08b-441a-b3eb-e2fae5eda712',  -- introcertis circle ID
  'approved',
  'Member',
  0
)
ON CONFLICT (user_id, community_id) 
DO UPDATE SET status = 'approved';
*/
