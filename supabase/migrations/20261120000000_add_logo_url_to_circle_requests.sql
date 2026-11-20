-- Add logo_url column to circle_requests so logo uploads are stored
-- and carried through to the community when the request is approved.
ALTER TABLE circle_requests
  ADD COLUMN IF NOT EXISTS logo_url text;
