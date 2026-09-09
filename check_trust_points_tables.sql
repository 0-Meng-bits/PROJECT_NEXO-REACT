-- Check if trust points system tables exist
-- Run this in Supabase SQL Editor to verify setup

-- Check point_transactions table
SELECT 
  'point_transactions' as table_name,
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'point_transactions'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status;

-- Check appreciation_cooldowns table
SELECT 
  'appreciation_cooldowns' as table_name,
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'appreciation_cooldowns'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status;

-- Check can_give_appreciation function
SELECT 
  'can_give_appreciation()' as function_name,
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'can_give_appreciation'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status;

-- If any show ❌ MISSING, you need to run the migration:
-- Look for file: supabase/migrations/20260826000000_trust_points_system.sql
-- Copy its contents and run in SQL Editor
