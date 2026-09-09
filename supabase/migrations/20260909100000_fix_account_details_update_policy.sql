-- Allow users to update their own account_details (profile info, cover photo, etc.)

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update own account_details" ON account_details;
DROP POLICY IF EXISTS "Allow self update" ON account_details;

-- Create new update policy that allows users to update their own row
CREATE POLICY "Users can update own profile"
ON account_details FOR UPDATE
TO public
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Also ensure insert policy exists for new users
DROP POLICY IF EXISTS "Users can insert own account_details" ON account_details;

CREATE POLICY "Users can insert own profile"  
ON account_details FOR INSERT
TO public
WITH CHECK (auth.uid() = id);
