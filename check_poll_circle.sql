-- Check which circle the "marcos" poll actually belongs to

SELECT 
  a.id as poll_id,
  a.title as poll_title,
  a.community_id as poll_community_id,
  c.name as circle_name,
  a.event_metadata->>'generated_event_id' as generated_event_id,
  a.event_metadata->>'event_date' as event_date,
  a.event_metadata->>'winning_option' as winning_option,
  a.event_metadata->>'is_closed' as is_closed
FROM announcements a
LEFT JOIN communities c ON c.id = a.community_id
WHERE a.post_type = 'poll'
  AND a.title LIKE '%TRY%' OR a.title LIKE '%marcos%'
ORDER BY a.created_at DESC;

-- Also check the campus_events to see what we have
SELECT 
  ce.id,
  ce.title,
  ce.community_id,
  c.name as assigned_circle,
  ce.description,
  ce.event_date
FROM campus_events ce
LEFT JOIN communities c ON c.id = ce.community_id
WHERE ce.title = 'marcos'
   OR ce.description LIKE '%marcos%';
