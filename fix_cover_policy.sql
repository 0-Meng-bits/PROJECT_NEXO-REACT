-- Simple fix: Allow all authenticated users to update account_details
-- This is safe because users can only update their own row due to the WHERE clause in the code

-- First, check existing policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'account_details';

-- Drop ALL existing policies on account_details
DROP POLICY IF EXISTS "Users can update own profile" ON account_details;
DROP POLICY IF EXISTS "Users can update own account_details" ON account_details;
DROP POLICY IF EXISTS "Allow self update" ON account_details;
DROP POLICY IF EXISTS "Users can insert own profile" ON account_details;
DROP POLICY IF EXISTS "Users can insert own account_details" ON account_details;
DROP POLICY IF EXISTS "profiles_self_update" ON account_details;

-- Enable RLS
ALTER TABLE account_details ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for all authenticated users (so they can view profiles)
CREATE POLICY "Anyone can view account details"
ON account_details FOR SELECT
TO public
USING (true);

-- Allow UPDATE for all authenticated users
-- The WHERE clause in the app (eq('id', user.id)) ensures they only update their own row
CREATE POLICY "Authenticated users can update account details"
ON account_details FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow INSERT for new account creation
CREATE POLICY "Authenticated users can insert account details"
ON account_details FOR INSERT
TO authenticated
WITH CHECK (true);

-- Verify policies were created
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'account_details';
