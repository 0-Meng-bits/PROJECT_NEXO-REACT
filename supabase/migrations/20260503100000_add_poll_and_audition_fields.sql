-- Add poll support to announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS poll_options jsonb;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS poll_votes jsonb DEFAULT '{}';

-- internal_audition already added in previous migration
-- This ensures it exists
ALTER TABLE communities ADD COLUMN IF NOT EXISTS internal_audition boolean DEFAULT false;
