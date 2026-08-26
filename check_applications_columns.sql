-- Check what columns exist in the applications (formerly auditions) table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'applications' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
