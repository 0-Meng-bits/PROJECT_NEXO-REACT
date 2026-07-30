-- Add cover_url to profiles table for Friendster-style profile covers
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url text;
