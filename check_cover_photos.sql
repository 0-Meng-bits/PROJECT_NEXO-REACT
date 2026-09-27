-- Check cover photos for all users
SELECT 
  a.id,
  a.ctu_id,
  a.full_name,
  ad.cover_url,
  CASE 
    WHEN ad.cover_url IS NULL THEN '❌ No cover'
    WHEN ad.cover_url LIKE 'data:image%' THEN '✅ Has cover (base64)'
    ELSE '✅ Has cover (URL)'
  END as cover_status,
  LENGTH(ad.cover_url) as cover_size_bytes
FROM accounts a
LEFT JOIN account_details ad ON a.id = ad.id
ORDER BY a.created_at DESC
LIMIT 20;
