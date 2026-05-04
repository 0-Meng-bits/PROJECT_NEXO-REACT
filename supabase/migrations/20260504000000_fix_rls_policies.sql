-- Allow anyone (anon + authenticated) to read profiles
-- The existing policy only covers UPDATE, not SELECT for all cases
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Anyone can read profiles"
  ON profiles FOR SELECT
  USING (true);

-- Allow authenticated users to read memberships
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Anyone can read memberships"
  ON memberships FOR SELECT
  USING (true);

-- Allow authenticated users to read communities
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Anyone can read communities"
  ON communities FOR SELECT
  USING (true);
