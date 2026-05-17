-- Multiple named auditions per circle
CREATE TABLE IF NOT EXISTS auditions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text DEFAULT 'external' CHECK (type IN ('external', 'internal')),
  is_open boolean DEFAULT true,
  post_to_feed boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Link questions to a specific audition (not just community)
ALTER TABLE audition_questions ADD COLUMN IF NOT EXISTS audition_id uuid REFERENCES auditions(id) ON DELETE CASCADE;

-- Link responses to a specific audition
ALTER TABLE audition_responses ADD COLUMN IF NOT EXISTS audition_id uuid REFERENCES auditions(id) ON DELETE CASCADE;
