-- Fix message_reactions to allow only ONE reaction per user per message
-- (using student_id instead of user_id)

-- First, delete duplicate reactions (keep only the most recent one per user per message)
DELETE FROM message_reactions a USING message_reactions b
WHERE a.id < b.id 
  AND a.message_id = b.message_id 
  AND a.student_id = b.student_id;

-- Drop the old constraint that allowed multiple reactions
ALTER TABLE message_reactions DROP CONSTRAINT IF EXISTS message_reactions_message_id_student_id_reaction_key;

-- Add new constraint: one reaction per user per message
ALTER TABLE message_reactions ADD CONSTRAINT message_reactions_message_id_student_id_key UNIQUE(message_id, student_id);
