-- =========================================================
-- MIGRATION: Fix avatars storage bucket policies
-- Date: 2026-08-11
-- Purpose: Add missing INSERT, UPDATE, DELETE policies for avatars
-- =========================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Public avatar read access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;

-- Public read access (anyone can view avatars)
CREATE POLICY "Public avatar read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload avatars
CREATE POLICY "Users can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own avatars
CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own avatars
CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Service role (backend) can do everything
CREATE POLICY "Service role full access to avatars"
  ON storage.objects
  TO service_role
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');
