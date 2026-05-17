-- Allow authenticated users to create communities
CREATE POLICY "Authenticated users can create communities"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- Allow authenticated users to update their own communities
CREATE POLICY "Creators can update their communities"
  ON communities FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id);
