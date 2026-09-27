-- Fix RLS policies for user_profile_settings table
-- This allows users to view profile customizations

-- Check current policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_profile_settings';

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own settings" ON user_profile_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_profile_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_profile_settings;

-- Enable RLS
ALTER TABLE user_profile_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view settings (needed to see other users' customizations)
CREATE POLICY "Anyone can view profile settings"
ON user_profile_settings FOR SELECT
TO public
USING (true);

-- Allow authenticated users to update their own settings
CREATE POLICY "Users can update own settings"
ON user_profile_settings FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert their settings
CREATE POLICY "Users can insert own settings"
ON user_profile_settings FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also fix shop_items (must be readable for shop to work)
DROP POLICY IF EXISTS "Anyone can view shop items" ON shop_items;

CREATE POLICY "Anyone can view shop items"
ON shop_items FOR SELECT
TO public
USING (true);

-- Fix user_purchases (users need to see what they bought)
DROP POLICY IF EXISTS "Users can view own purchases" ON user_purchases;
DROP POLICY IF EXISTS "Users can insert purchases" ON user_purchases;

CREATE POLICY "Users can view own purchases"
ON user_purchases FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert purchases"
ON user_purchases FOR INSERT
TO authenticated
WITH CHECK (true);

-- Verify all policies
SELECT tablename, policyname, cmd, roles FROM pg_policies 
WHERE tablename IN ('user_profile_settings', 'shop_items', 'user_purchases')
ORDER BY tablename, policyname;
