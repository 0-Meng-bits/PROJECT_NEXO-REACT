-- Allow reading profiles publicly
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
CREATE POLICY "Anyone can read profiles"
  ON profiles FOR SELECT USING (true);

-- Allow reading memberships
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read memberships" ON memberships;
CREATE POLICY "Anyone can read memberships"
  ON memberships FOR SELECT USING (true);

-- Allow reading communities
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read communities" ON communities;
CREATE POLICY "Anyone can read communities"
  ON communities FOR SELECT USING (true);
