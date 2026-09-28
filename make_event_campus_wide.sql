-- Make the "marcos" event campus-wide so everyone can see it
-- (This removes it from circle-only visibility)

UPDATE campus_events
SET community_id = NULL
WHERE title = 'marcos'
  AND event_date = '2026-09-28';

-- Verify it's now campus-wide
SELECT 
  id,
  title,
  community_id,
  event_date,
  CASE 
    WHEN community_id IS NULL THEN 'Campus-Wide (visible to all)'
    ELSE 'Circle-Only (visible to members)'
  END as visibility
FROM campus_events
WHERE title = 'marcos';
