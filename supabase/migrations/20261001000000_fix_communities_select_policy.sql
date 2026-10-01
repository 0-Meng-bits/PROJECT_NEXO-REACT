-- Fix missing SELECT policy on communities table
-- Without this, authenticated users cannot read communities data
CREATE POLICY "Anyone can read communities"
  ON communities FOR SELECT
  TO authenticated
  USING (true);
