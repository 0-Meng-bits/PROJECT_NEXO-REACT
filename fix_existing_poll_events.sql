-- Fix existing poll-generated events that have NULL community_id
-- This script updates events created BEFORE the backend was updated

-- Step 1: Find poll-generated events with NULL community_id
SELECT 
  ce.id,
  ce.title,
  ce.description,
  ce.community_id,
  ce.event_date,
  a.community_id as poll_community_id,
  c.name as circle_name
FROM campus_events ce
LEFT JOIN announcements a ON a.event_metadata->>'generated_event_id' = ce.id::text
LEFT JOIN communities c ON c.id = a.community_id
WHERE ce.community_id IS NULL
  AND ce.description LIKE '%created from the poll%'
  AND a.community_id IS NOT NULL;

-- Step 2: Update those events with the correct community_id from their source poll
UPDATE campus_events
SET community_id = (
  SELECT a.community_id
  FROM announcements a
  WHERE a.event_metadata->>'generated_event_id' = campus_events.id::text
    AND a.post_type = 'poll'
)
WHERE campus_events.community_id IS NULL
  AND campus_events.description LIKE '%created from the poll%'
  AND EXISTS (
    SELECT 1
    FROM announcements a
    WHERE a.event_metadata->>'generated_event_id' = campus_events.id::text
      AND a.community_id IS NOT NULL
  );

-- Step 3: Verify the fix
SELECT 
  ce.id,
  ce.title,
  ce.community_id,
  c.name as circle_name,
  ce.event_date
FROM campus_events ce
LEFT JOIN communities c ON c.id = ce.community_id
WHERE ce.description LIKE '%created from the poll%'
ORDER BY ce.event_date;
