-- Fix message_reactions to allow only ONE reaction per user per message
-- Drop the old constraint that allowed multiple reactions
ALTER TABLE message_reactions DROP CONSTRAINT IF EXISTS message_reactions_message_id_user_id_reaction_key;

-- Add new constraint: one reaction per user per message
ALTER TABLE message_reactions ADD CONSTRAINT message_reactions_message_id_user_id_key UNIQUE(message_id, user_id);
