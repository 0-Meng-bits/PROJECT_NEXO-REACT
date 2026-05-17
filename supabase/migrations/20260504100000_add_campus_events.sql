CREATE TABLE IF NOT EXISTS campus_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text DEFAULT 'general',
  start_date date NOT NULL,
  end_date date,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
