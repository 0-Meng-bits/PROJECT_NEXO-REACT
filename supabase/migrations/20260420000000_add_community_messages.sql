-- Add community_id and role to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'MEMBER';

-- Add status column to community_members if not exists
ALTER TABLE community_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Index for faster community message queries
CREATE INDEX IF NOT EXISTS idx_messages_community_id ON messages(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_community_id ON community_members(community_id);
